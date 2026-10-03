import asyncio
import json
import httpx
import pytest
from fastapi.testclient import TestClient
from bs4 import BeautifulSoup
import app as web
from engine import question_router
from certification import translation_service as translation


def test_korean_device_guide_has_substance_and_official_files():
    web.LIMITS.clear()
    with TestClient(web.app) as client:
        page = BeautifulSoup(client.get('/export-intelligence?domain=Medical+Devices&lang=ko&region=EMA').text, 'html.parser')
        assert page.html['lang'] == 'ko'
        assert page.find('h1').get_text() == '시장 진입에 필요한 준비 내용을 확인하세요'
        result = client.get('/api/export/checklist?category=DEVICE&country=EMA&lang=ko').json()
        assert len(result['checklist']) >= 6
        assert '멸균' in ' '.join(result['checklist'])
        assert '2020' in result['message']
        assert any(source.get('format') == 'PDF' for source in result['sources'])
        assert client.get('/api/export/checklist?lang=xx').status_code == 422


@pytest.mark.parametrize('number', ['356h','1571'])
def test_form_explanation_and_actual_pdf(number):
    result = asyncio.run(question_router.answer('FDA '+number+' 양식 주세요', 'Pharmaceuticals', 'FDA', 'ko'))
    assert result['status'] == 'DOCUMENT_LINKS'
    assert result['sources'][0]['format'] == 'PDF'
    assert '/media/' in result['sources'][0]['url']
    assert len(result['message']) > 90


@pytest.mark.parametrize('finish,translated,expected', [('stop','자료 10개를 제출하세요.',True),('length','자료 10개를 제출하세요.',False),('stop','자료 11개를 제출하세요.',False)])
def test_groq_translation_rejects_truncation_and_number_changes(monkeypatch,finish,translated,expected):
    monkeypatch.delenv('DEEPL_API_KEY',raising=False)
    monkeypatch.setenv('GROQ_API_KEY','test-only')
    original = httpx.AsyncClient
    def handler(request):
        body=json.loads(request.content)
        assert '10' in body['messages'][1]['content']
        return httpx.Response(200,json={'choices':[{'finish_reason':finish,'message':{'content':json.dumps({'translated_text':translated,'detected_source_language':'en'})}}]})
    monkeypatch.setattr(translation.httpx,'AsyncClient',lambda **kwargs: original(transport=httpx.MockTransport(handler),**kwargs))
    if expected:
        result=asyncio.run(translation.translate('Submit 10 records.','en','ko'))
        assert result['engine']=='Groq'
        assert result['translated_text']==translated
    else:
        with pytest.raises(translation.TranslationError):
            asyncio.run(translation.translate('Submit 10 records.','en','ko'))


def test_official_translation_rejects_arbitrary_urls_and_missing_consent():
    web.LIMITS.clear()
    with TestClient(web.app) as client:
        assert client.post('/api/translate-official',json={'document_id':'fda-356h'}).status_code == 400
        assert client.post('/api/translate-official',json={'document_id':'https://localhost/private','consent':True}).status_code == 422


def test_official_snapshot_translation_has_version_and_full_text(monkeypatch):
    from unittest.mock import AsyncMock
    web.LIMITS.clear()
    monkeypatch.setattr(web,'translation_configured',lambda:True)
    translate = AsyncMock(return_value={'status':'SUCCESS','translated_text':'번역 예시','message':'검토용'})
    monkeypatch.setattr(web,'translate',translate)
    with TestClient(web.app) as client:
        result=client.post('/api/translate-official',json={'document_id':'fda-1571','target_lang':'ko','consent':True})
        assert result.status_code==200
        assert result.json()['source_reviewed_at']=='2026-10-03'
        assert len(translate.call_args.args[0])>8000
        assert client.post('/api/translate-official',json={'document_id':'fda-356h-instructions','consent':True}).status_code==413


def test_cosmetic_guide_keeps_exemption_conditions():
    from engine.export_guidance import cosmetics_fda
    text=' '.join(cosmetics_fda('ko')['checklist'])
    assert '24시간' in text and '제거' in text and '특정 소기업' in text
