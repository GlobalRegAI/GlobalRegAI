import asyncio
import httpx
from fastapi.testclient import TestClient
from engine import ai_config, regulatory_search as research
from app import app


def test_default_is_basic_even_with_existing_secret(monkeypatch):
    monkeypatch.delenv('GLOBALREGAI_AI_PROVIDER', raising=False)
    monkeypatch.setenv('GROQ_API_KEY', 'never-send-this')
    assert not ai_config.configured()
    with TestClient(app) as client:
        assert client.get('/api/health').json()['capabilities']['service_mode'] == 'FREE_BASIC'
        assert '무료 기본 서비스' in client.get('/?lang=ko').text
        assert 'never-send-this' not in client.get('/').text


def test_basic_retrieves_sources_but_never_calls_inference(monkeypatch):
    monkeypatch.setenv('GLOBALREGAI_AI_PROVIDER', 'none')
    monkeypatch.setenv('GROQ_API_KEY', 'never-send-this')
    async def source(client, entry):
        return {**entry, 'text':'MoCRA exempts certain small businesses from registration requirements.', 'retrieval_status':'RETRIEVED'}
    async def forbidden(*args, **kwargs):
        raise AssertionError('Basic mode must never send an inference request')
    monkeypatch.setattr(research, 'fetch_source', source)
    monkeypatch.setattr(httpx.AsyncClient, 'post', forbidden)
    result = asyncio.run(research.search('MoCRA exemptions', 'Cosmetics', 'FDA', 'ko'))
    assert result['status'] == 'SOURCES_ONLY'
    assert result['sources'] and not result['claims'] and not result['llm_used']


def test_unknown_provider_fails_closed(monkeypatch):
    monkeypatch.setenv('GLOBALREGAI_AI_PROVIDER', 'typo')
    monkeypatch.setenv('GROQ_API_KEY', 'secret')
    assert not ai_config.configured()


def test_excerpt_finds_late_exemption_instead_of_intro():
    body = 'MoCRA facility registration. ' * 100 + 'Exemptions apply only to certain small businesses. Read all exclusions.'
    excerpt = research.public_source({'text':body}, 'Which MoCRA facility registration exemptions should I check?')
    assert 'Exemptions apply only' in excerpt['excerpt']
    assert len(excerpt['excerpt']) <= 1002
    assert excerpt['excerpt_is_partial']
