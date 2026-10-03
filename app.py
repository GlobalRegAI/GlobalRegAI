"""GlobalRegAI web application. Live services never fall back to invented regulatory data."""
import asyncio
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Literal
from urllib.parse import urlencode
import httpx

from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, field_validator

from engine import regulatory_search
from engine import ai_config
from engine import question_router
from engine.audit_engine import audit_engine, PRODUCT_CATEGORIES
from certification.translation_service import extract_text, translate, TranslationError, MAX_FILE_BYTES, configured as translation_configured

ROOT = Path(__file__).resolve().parent
app = FastAPI(title='GlobalRegAI', version='15.0.0')
app.mount('/static', StaticFiles(directory=ROOT / 'static'), name='static')
templates = Jinja2Templates(directory=ROOT / 'templates')
LOG = logging.getLogger('globalregai')
LIMITS = OrderedDict()
LIMIT_LOCK = threading.Lock()


class SearchPayload(BaseModel):
    query: str = Field(min_length=3, max_length=4000)
    target_region: str = 'ALL'
    domain: str = 'Pharmaceuticals'
    lang: str = 'en'

    @field_validator('query')
    @classmethod
    def nonblank(cls, value):
        if len(value.strip()) < 3:
            raise ValueError('Please enter a question of at least 3 characters.')
        return value.strip()

    @field_validator('domain')
    @classmethod
    def valid_domain(cls, value):
        if value not in regulatory_search.DOMAINS:
            raise ValueError('Unsupported domain')
        return value

    @field_validator('target_region')
    @classmethod
    def valid_region(cls, value):
        if value not in regulatory_search.REGIONS:
            raise ValueError('Unsupported jurisdiction')
        return value

    @field_validator('lang')
    @classmethod
    def valid_lang(cls, value):
        if value not in regulatory_search.LANGUAGES:
            raise ValueError('Unsupported language')
        return value


class TranslatePayload(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    source_lang: str = 'auto'
    target_lang: str = 'ko'
    consent: bool = False


class OfficialTranslationPayload(BaseModel):
    document_id: str = Field(max_length=60)
    target_lang: str = 'ko'
    consent: bool = False


class AuditPayload(BaseModel):
    product_name: str = Field(min_length=1, max_length=200)
    batch_size: str = Field(default='', max_length=100)
    has_hbel_pde: bool | None = None
    process_validation_age: int | None = Field(default=None, ge=0, le=100)
    hvac_status: Literal['UNKNOWN', 'COMPLIANT', 'DEVIATION'] = 'UNKNOWN'
    target_region: Literal['FDA', 'EMA', 'MFDS', 'PMDA', 'NMPA', 'MHRA'] = 'MFDS'
    lang: Literal['en', 'ko', 'ja', 'zh', 'de', 'fr', 'es'] = 'en'


class LoginPayload(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=1024)


def admin_configured():
    return bool(os.getenv('GLOBALREGAI_ADMIN_USER') and os.getenv('GLOBALREGAI_ADMIN_PASSWORD_HASH') and len(os.getenv('GLOBALREGAI_SESSION_SECRET', '')) >= 32)


def session_signature(payload):
    # Password rotation also revokes existing sessions.
    key = os.environ['GLOBALREGAI_SESSION_SECRET'] + os.environ['GLOBALREGAI_ADMIN_PASSWORD_HASH']
    return hmac.new(key.encode(), payload.encode(), hashlib.sha256).hexdigest()


def authenticated(request):
    if not admin_configured():
        return False
    try:
        token = request.cookies.get('dev_auth_token', '')
        timestamp, nonce, signature = token.split('.')
        age = time.time() - int(timestamp)
        return 0 <= age <= 3600 and hmac.compare_digest(signature, session_signature(timestamp+'.'+nonce))
    except (ValueError, KeyError):
        return False


def require_admin(request):
    if not authenticated(request):
        raise HTTPException(401, 'Administrator sign-in required.')


def throttle(request, kind, maximum):
    # Per-worker abuse guard. Production multi-instance quotas require a shared store or platform rate limits.
    key = (request.client.host if request.client else 'unknown', kind)
    stamp = time.monotonic()
    with LIMIT_LOCK:
        previous = [t for t in LIMITS.pop(key, []) if stamp-t < 60]
        LIMITS[key] = previous
        while len(LIMITS) > 2048:
            LIMITS.popitem(last=False)
        if len(previous) >= maximum:
            raise HTTPException(429, 'Too many requests. Please retry in one minute.', headers={'Retry-After': '60'})
        previous.append(stamp)


@app.middleware('http')
async def response_guards(request, call_next):
    request_id = secrets.token_hex(8)
    # Browser mutations must come from this application's origin.
    origin = request.headers.get('origin')
    if request.method not in ('GET', 'HEAD', 'OPTIONS') and origin and origin.rstrip('/') != str(request.base_url).rstrip('/'):
        return JSONResponse({'status': 'ERROR', 'message': 'Cross-origin request rejected.'}, status_code=403)
    try:
        length = int(request.headers.get('content-length', '0'))
    except ValueError:
        return JSONResponse({'status': 'ERROR', 'message': 'Invalid content length.'}, status_code=400)
    if length > MAX_FILE_BYTES + 65536:
        return JSONResponse({'status': 'ERROR', 'message': 'Request is too large.'}, status_code=413)
    try:
        response = await call_next(request)
    except Exception:
        # Do not log submitted questions, documents or provider response bodies.
        LOG.error('request_failed id=%s path=%s', request_id, request.url.path)
        response = JSONResponse({'status': 'ERROR', 'message': 'The request could not be completed. Please retry.', 'request_id': request_id}, status_code=500)
    response.headers.update({'X-Request-ID': request_id, 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"})
    if not request.url.path.startswith('/static/'):
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(TranslationError)
async def translation_failure(request, exc):
    return JSONResponse({'status': 'ERROR', 'message': str(exc)}, status_code=exc.status)


@app.get('/api/health')
def health():
    return {'status': 'OK', 'version': app.version, 'capabilities': {
        'answer_synthesis': 'CONFIGURED_NOT_PROBED' if ai_config.configured() else 'NOT_CONFIGURED',
        'translation': 'CONFIGURED_NOT_PROBED' if translation_configured() else 'NOT_CONFIGURED',
        'official_source_count': len(regulatory_search.SOURCES), 'vault': 'NOT_CONNECTED',
        'browser_agent': 'NOT_CONNECTED'}}


@app.post('/api/search')
async def search_api(payload: SearchPayload, request: Request):
    throttle(request, 'search', 30)
    return await question_router.answer(payload.query, payload.domain, payload.target_region, payload.lang)


@app.get('/api/search')
async def search_get(request: Request, q: str = Query(min_length=3, max_length=4000), region: str = 'ALL', domain: str = 'Pharmaceuticals', lang: str = 'en'):
    try:
        payload = SearchPayload(query=q, target_region=region, domain=domain, lang=lang)
    except ValueError:
        raise HTTPException(422, 'Invalid query, domain, jurisdiction or language.')
    return await search_api(payload, request)


@app.post('/api/translate')
async def translate_api(payload: TranslatePayload, request: Request):
    throttle(request, 'translation', 10)
    if not payload.consent:
        raise HTTPException(400, 'Confirm that this text may be sent to the translation provider.')
    return await translate(payload.text, payload.source_lang.lower(), payload.target_lang.lower())


@app.post('/api/certification/translate-file')
async def translate_file(request: Request, file: UploadFile = File(...), source_lang: str = Form('auto'), target_lang: str = Form('ko'), consent: bool = Form(False)):
    throttle(request, 'translation', 10)
    if not consent:
        raise HTTPException(400, 'Confirm that extracted text may be sent to the translation provider.')
    if not translation_configured():
        raise TranslationError('Translation is not configured. No document was sent to a provider.', 503)
    content = await file.read(MAX_FILE_BYTES + 1)
    await file.close()
    text = await asyncio.to_thread(extract_text, file.filename, content)
    result = await translate(text, source_lang.lower(), target_lang.lower())
    return {**result, 'file_name': file.filename, 'total_characters': len(text), 'translated_content': result['translated_text']}


@app.post('/api/translate-official')
async def translate_official(payload: OfficialTranslationPayload, request: Request):
    from engine.document_catalogue import FORMS, form_documents
    throttle(request, 'translation', 10)
    if not payload.consent:
        raise HTTPException(400, 'Translation provider consent is required.')
    documents = {doc['id']: doc for number in FORMS for doc in form_documents(number, 'en')}
    document = documents.get(payload.document_id)
    if not document or payload.target_lang not in regulatory_search.LANGUAGES:
        raise HTTPException(422, 'Unsupported document or language.')
    if not translation_configured():
        raise TranslationError('Translation is not configured.', 503)
    # Only reviewed fixed file URLs. No caller-supplied URL or redirects.
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            async with client.stream('GET', document['url']) as response:
                response.raise_for_status()
                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > MAX_FILE_BYTES:
                        raise TranslationError('Document exceeds the 2 MB limit.', 413)
        text = await asyncio.to_thread(extract_text, 'official.pdf', bytes(content))
        translated = await translate(text, 'en', payload.target_lang)
        return {**translated, 'original_url': document['url']}
    except httpx.HTTPError as exc:
        raise TranslationError('공식 서류를 가져오지 못했습니다. 원본 파일 링크를 이용해 주세요.' if payload.target_lang == 'ko' else
                               'The official file could not be retrieved. Use the original file link.', 503) from exc


@app.post('/api/audit/diagnose')
def audit_api(payload: AuditPayload):
    return audit_engine.diagnose_gmp_gaps({**payload.model_dump(),
        'cleaning_validation_report': {'has_hbel_pde': payload.has_hbel_pde},
        'process_validation_report': {'age_years': payload.process_validation_age},
        'hvac_em_report': {'status': payload.hvac_status}}, payload.lang)


@app.get('/api/export/checklist')
async def export_checklist(request: Request, category: str = 'PHARMA', country: str = 'FDA', lang: str = 'en'):
    throttle(request, 'export', 15)
    if lang not in regulatory_search.LANGUAGES:
        raise HTTPException(422, 'Unsupported language.')
    if category not in PRODUCT_CATEGORIES or country not in regulatory_search.REGIONS or country == 'ALL':
        raise HTTPException(422, 'Choose a supported product category and jurisdiction.')
    domains = {'PHARMA': 'Pharmaceuticals', 'COSMETIC': 'Cosmetics', 'DEVICE': 'Medical Devices',
               'SANITIZER': 'Chemicals', 'FOOD': 'Food Safety', 'CHEMICAL': 'Chemicals'}
    if category == 'DEVICE' and country == 'EMA':
        from engine.export_guidance import device_eu
        guide = device_eu(lang)
        if lang not in ('en', 'ko'):
            translated = await translate('\n\n'.join([guide['message']] + guide['checklist']), 'en', lang)
            guide['message'] = translated['translated_text']
            guide['checklist'] = []
        return guide
    query = (f"Explain practical export preparation for {domains[category]} in {regulatory_search.REGIONS[country]}. "
             "Explain requirements, exceptions, required documents and next steps, not just questions or links.")
    answer = await regulatory_search.search(query, domains[category], country, lang)
    if answer.get('claims'):
        return {'status': 'PLANNING_ONLY', 'product_category': category, 'target_country': country,
                'checklist': [], 'claims': answer['claims'], 'sources': answer.get('sources', []),
                'message': answer.get('message', ''), 'interpretation_verified': False}
    return {'status': 'PLANNING_ONLY', 'product_category': category, 'target_country': country,
            'checklist': [], 'sources': answer.get('sources', []),
            'message': ('현재 이 국가·제품에 대한 설명을 작성할 공식 근거 또는 AI 응답을 확보하지 못했습니다. 규제 질문에서 제품명·사용 목적·필요한 서류를 구체적으로 입력해 주세요. 일반 질문 목록을 실제 요건처럼 제시하지 않습니다.' if lang == 'ko' else
                        'A source-grounded explanation could not be completed for this product and market. Ask a specific research question including intended use and required documents. No complete requirements or eligibility determination is available.')}



@app.get('/api/export/ingredient')
def ingredient_lookup(name: str = Query(min_length=1, max_length=200)):
    return JSONResponse({'status': 'UNVERIFIED', 'matches': [], 'message': 'No validated ingredient-limit database is connected. Product type, concentration, use and jurisdiction must be assessed against official sources.'}, status_code=503)


@app.post('/api/auth/login')
def login(payload: LoginPayload, request: Request):
    throttle(request, 'login', 5)
    if not admin_configured():
        raise HTTPException(503, 'Administrator access is not configured.')
    try:
        algorithm, iterations, salt, expected = os.environ['GLOBALREGAI_ADMIN_PASSWORD_HASH'].split('$')
        if algorithm != 'pbkdf2_sha256' or not 600000 <= int(iterations) <= 2000000:
            raise ValueError('Invalid password hash configuration')
        digest = hashlib.pbkdf2_hmac('sha256', payload.password.encode(), bytes.fromhex(salt), int(iterations)).hex()
        valid = hmac.compare_digest(digest, expected) & hmac.compare_digest(payload.username.encode(), os.environ['GLOBALREGAI_ADMIN_USER'].encode())
    except (ValueError, KeyError):
        raise HTTPException(503, 'Administrator access is not configured correctly.')
    if not valid:
        raise HTTPException(401, 'Invalid administrator credentials.')
    value = str(int(time.time()))+'.'+secrets.token_hex(16)
    response = JSONResponse({'status': 'SUCCESS'})
    response.set_cookie('dev_auth_token', value+'.'+session_signature(value), max_age=3600, httponly=True,
                        secure=request.url.scheme == 'https', samesite='strict', path='/')
    return response


@app.post('/api/auth/logout')
def logout():
    response = JSONResponse({'status': 'SUCCESS'})
    response.delete_cookie('dev_auth_token', path='/')
    return response


@app.get('/api/mcp/status')
def mcp_status(request: Request):
    require_admin(request)
    return {**health(), 'ai_configuration': ai_config.configuration_status(), 'mcp_status': 'NOT_CONNECTED', 'rate_limit_scope': 'per_worker',
            'notice': 'Configuration presence does not establish upstream availability. No tenant document store or autonomous browser service is connected.'}


@app.get('/api/vault/search')
@app.get('/api/vault/batch')
def vault_api(request: Request):
    require_admin(request)
    raise HTTPException(503, 'A tenant-isolated document store is not connected. No documents or batch records are available.')


# Legacy government routes now use real adapters; unavailable records are explicit.
@app.get('/api/gov/fda-label')
async def fda_label(drug_name: str = Query(min_length=1, max_length=100)):
    from engine.gov_api_client import gov_api_client
    return await gov_api_client.fetch_openfda_drug_label(drug_name)


@app.get('/api/gov/pubchem-compound')
async def compound(name: str = Query(min_length=1, max_length=100)):
    from engine.gov_api_client import gov_api_client
    return await gov_api_client.fetch_pubchem_compound_data(name)


@app.get('/api/gov/mfds-drug')
def mfds_drug(name: str = Query(min_length=1, max_length=100)):
    return JSONResponse({'status': 'NOT_CONFIGURED', 'message': 'An authenticated MFDS data adapter is not connected. No approval status has been verified.'}, status_code=503)


PAGES = {'/': ('qa', 'Regulatory research'), '/gmp-core': ('gmp', 'GMP evidence review'),
         '/export-intelligence': ('export', 'Export planning'), '/certification/translate': ('translation', 'Document translation'),
         '/confidential-vault': ('vault', 'Confidential vault'), '/agent-portal': ('agent', 'Browser agent'),
         '/developer-console': ('admin', 'Administrator')}


def page(request: Request, domain: str = 'Pharmaceuticals', lang: str = 'en'):
    if domain not in regulatory_search.DOMAINS or lang not in regulatory_search.LANGUAGES:
        raise HTTPException(422, 'Unsupported domain or language. Return to the homepage and choose from the available options.')
    active, title = PAGES[request.url.path]
    ui = json.loads((ROOT / 'static/ko.json').read_text(encoding='utf-8')) if lang == 'ko' else {}
    return templates.TemplateResponse(request=request, name='workspace.html', context={
        'ui': ui, 'tr': lambda text: ui.get(text, text), 'active': active, 'title': title, 'domain': domain, 'lang': lang,
        'domains': regulatory_search.DOMAINS, 'regions': regulatory_search.REGIONS,
        'languages': regulatory_search.LANGUAGES, 'pages': PAGES,
        'page_url': lambda path, d=domain: path+'?'+urlencode({'domain': d, 'lang': lang}),
        'authenticated': authenticated(request), 'admin_configured': admin_configured(),
        'ai_configured': ai_config.configured(), 'translation_configured': translation_configured(),
        'sources': regulatory_search.SOURCES})


for path in PAGES:
    app.add_api_route(path, page, methods=['GET'], include_in_schema=False)


@app.get('/app-portal', include_in_schema=False)
def app_portal():
    return RedirectResponse('/agent-portal')


@app.get('/test_portal', include_in_schema=False)
def old_test_portal(request: Request):
    require_admin(request)
    return RedirectResponse('/developer-console')


@app.get('/ads.txt', response_class=PlainTextResponse)
def ads_txt():
    return 'google.com, pub-9335333067725848, DIRECT, f08c47fec0942fa0\n'


@app.get('/robots.txt', response_class=PlainTextResponse)
def robots_txt():
    return 'User-agent: *\nAllow: /\nSitemap: https://globalregai.info/sitemap.xml\n'


@app.get('/sitemap.xml')
def sitemap_xml():
    return Response(content='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://globalregai.info/</loc></url></urlset>', media_type='application/xml')
