"""Non-sensitive live checks; prints configuration presence, never secrets.

Run against the configured environment before a release. DRAFT is not evidence of
regulatory correctness: a qualified reviewer still needs to assess the answer.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from engine import regulatory_search as research
from certification.translation_service import translate, TranslationError


async def main():
    async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
        sources = await asyncio.gather(*(research.fetch_source(client, source) for source in research.SOURCES))
    report = {'sources': [{key: source.get(key) for key in ('id', 'retrieval_status', 'content_sha256')} for source in sources]}
    if os.getenv('GROQ_API_KEY'):
        result = await research.search('Which MoCRA facility registration exemptions should a cosmetic manufacturer check?', 'Cosmetics', 'FDA', 'en')
        report['ai'] = {'status': result['status'], 'claim_count': len(result['claims']), 'quality_review': 'NOT_PERFORMED'}
    else:
        report['ai'] = {'status': 'NOT_CONFIGURED', 'quality_review': 'NOT_PERFORMED'}
    if os.getenv('DEEPL_API_KEY'):
        try:
            result = await translate('The sample contains 25 mg. Store at 20 degrees Celsius.', 'en', 'ko')
            report['translation'] = {'status': result['status'], 'quality_review': 'NOT_PERFORMED'}
        except TranslationError:
            report['translation'] = {'status': 'UNAVAILABLE'}
    else:
        report['translation'] = {'status': 'NOT_CONFIGURED'}
    report['production_release_approved'] = False
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
