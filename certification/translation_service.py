"""Document extraction and configured-provider translation with explicit failure states."""
import io
import asyncio
import os
import zipfile
from pathlib import Path
import httpx
from pypdf import PdfReader
from docx import Document

MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_TEXT_CHARS = 12000
LANGS = {'en', 'ko', 'ja', 'zh', 'de', 'fr', 'es', 'pt'}


class TranslationError(Exception):
    def __init__(self, message, status=422):
        super().__init__(message)
        self.status = status


def extract_text(filename, content):
    if not content or len(content) > MAX_FILE_BYTES:
        raise TranslationError('Provide a non-empty document no larger than 2 MB.', 413)
    ext = Path(filename or '').suffix.lower()
    try:
        if ext == '.pdf':
            if not content.startswith(b'%PDF-'):
                raise ValueError('Invalid PDF')
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted or len(reader.pages) > 50:
                raise TranslationError('Encrypted PDFs and documents over 50 pages are not supported.')
            pages = [page.extract_text() or '' for page in reader.pages]
            if any(not page.strip() for page in pages):
                raise TranslationError('One or more PDF pages have no extractable text. OCR is required before translation.')
            text = '\n\n'.join(pages)
        elif ext == '.docx':
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(info.file_size for info in archive.infolist()) > 10 * 1024 * 1024:
                    raise TranslationError('The expanded document is too large.')
            document = Document(io.BytesIO(content))
            # Preserve body paragraph/table order. Headers, footers and images are excluded explicitly in the UI.
            parts = []
            from docx.oxml.ns import qn
            for item in document.element.body:
                if item.tag in (qn('w:p'), qn('w:tbl')):
                    parts.append(' '.join(node.text or '' for node in item.iter(qn('w:t'))))
            text = '\n'.join(parts)
        elif ext in ('.txt', '.md'):
            text = content.decode('utf-8-sig')
        else:
            raise TranslationError('Supported formats: text-based PDF, DOCX, UTF-8 TXT and MD.', 415)
    except TranslationError:
        raise
    except Exception as exc:
        raise TranslationError('The document could not be read. Export a valid text-based PDF, DOCX or UTF-8 TXT file.') from exc
    if not text.strip():
        raise TranslationError('No extractable text was found. Scanned documents require OCR.')
    if len(text) > MAX_TEXT_CHARS:
        raise TranslationError('Extracted text exceeds 12,000 characters. Split the document; no text has been truncated.', 413)
    if '\x00' in text:
        raise TranslationError('Binary content is not supported.')
    return text


async def translate(text, source, target):
    if target not in LANGS or source not in LANGS | {'auto'}:
        raise TranslationError('Unsupported language.')
    if not text.strip() or len(text) > MAX_TEXT_CHARS:
        raise TranslationError('Text must contain 1–12,000 characters.')
    if text.lstrip().startswith('%PDF-') or '\x00' in text:
        raise TranslationError('Upload the PDF document instead of pasting binary content.')
    if source == target:
        return {'status': 'UNCHANGED', 'translated_text': text, 'message': 'Source and target languages are the same. No translation was performed.'}
    key = os.getenv('DEEPL_API_KEY')
    if not key:
        raise TranslationError('Translation is not configured. No translation was performed.', 503)
    # Only vendor endpoints can be selected; no arbitrary forwarding URL.
    plan = os.getenv('DEEPL_API_PLAN', 'free').strip().lower()
    if plan not in {'free', 'pro'}:
        raise TranslationError('Invalid DEEPL_API_PLAN configuration. Choose free or pro. No text was sent.', 503)
    host = 'api-free.deepl.com' if plan == 'free' else 'api.deepl.com'
    body = {'text': [text], 'target_lang': target.upper()}
    if source != 'auto':
        body['source_lang'] = source.upper()
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await asyncio.wait_for(client.post('https://'+host+'/v2/translate', json=body, headers={'Authorization': 'DeepL-Auth-Key '+key}), timeout=22)
        response.raise_for_status()
        item = response.json()['translations'][0]
        translated = item['text']
        if not isinstance(translated, str) or not translated.strip():
            raise ValueError('Empty translation')
        return {'status': 'SUCCESS', 'engine': 'DeepL', 'source_lang': item.get('detected_source_language', source),
                'target_lang': target, 'translated_text': translated,
                'message': 'Machine translation — review terminology, numbers and meaning before use. Not a certified translation.'}
    except (httpx.HTTPError, asyncio.TimeoutError, KeyError, IndexError, ValueError, TypeError) as exc:
        raise TranslationError('The translation provider is unavailable. No substitute or partial translation was returned.', 503) from exc
