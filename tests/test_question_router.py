import asyncio
from unittest.mock import AsyncMock
import pytest
from engine import question_router as router


def ask(query, region='ALL', domain='Pharmaceuticals'):
    return asyncio.run(router.answer(query, domain, region, 'ko'))


@pytest.fixture
def no_llm(monkeypatch):
    mock = AsyncMock(side_effect=AssertionError('Navigation must not invoke research'))
    monkeypatch.setattr(router.research, 'search', mock)
    return mock


def test_exact_document_without_llm(no_llm):
    r = ask('Where can I download FDA Form 356h?')
    assert r['status'] == 'DOCUMENT_LINKS'
    assert r['target_region'] == 'FDA'
    assert r['sources'][0]['url'].startswith('https://www.fda.gov/')
    assert not r['llm_used']


def test_ambiguous_document_then_selection(no_llm):
    assert ask('허가 서류가 필요합니다')['status'] == 'CLARIFICATION_REQUIRED'
    assert ask('허가 서류가 필요합니다', 'MFDS')['sources'][0]['url'].endswith('/m_1208/list.do')


def test_eu_devices_do_not_go_to_ema(no_llm):
    r = ask('EU MDR 담당 기관 문의', domain='Medical Devices')
    assert r['status'] == 'AGENCY_CONTACT'
    assert 'health.ec.europa.eu' in r['sources'][0]['url']
    assert '회원국' in r['message']


def test_scope_conflict(no_llm):
    r = ask('FDA contact email', 'MFDS')
    assert r['status'] == 'SCOPE_CONFLICT'
    assert r['choices'][0]['target_region'] == 'FDA'


def test_no_fabricated_contacts(no_llm):
    r = ask('PMDA 담당 기관 문의')
    assert r['status'] == 'NOT_COVERED'
    assert not r['sources']


def test_complex_question_keeps_research(monkeypatch):
    mock = AsyncMock(return_value={'status': 'INSUFFICIENT_EVIDENCE'})
    monkeypatch.setattr(router.research, 'search', mock)
    assert ask('How do I complete FDA Form 356h?')['route'] == 'GROUNDED_RESEARCH'
    mock.assert_awaited_once()
