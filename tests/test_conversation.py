import asyncio
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
from bs4 import BeautifulSoup
import app as web
from engine import conversation as c, regulatory_search as r
from engine.regulatory_graph import build_graph

@pytest.fixture
def client():
    web.LIMITS.clear()
    with TestClient(web.app, base_url='https://testserver') as client:
        yield client

def test_home_is_single_question_without_sidebar(client):
    soup = BeautifulSoup(client.get('/').text,'html.parser')
    assert len(soup.select('textarea')) == 1
    assert soup.select_one('#question')
    assert not soup.select('.sidebar,.tabs,.domain-link')
    assert soup.select_one('#language')

@pytest.mark.parametrize('query,field', [('허가 절차를 알려주세요','domain'),('화장품 등록 요건','regions'),('한국에서 만든 화장품을 미국에 수출하려 합니다','regions')])
def test_clarifies_before_retrieval(client,monkeypatch,query,field):
    mock=AsyncMock(side_effect=AssertionError('Do not retrieve before scope'))
    monkeypatch.setattr(r,'search',mock)
    data=client.post('/api/conversation',json={'query':query}).json()
    assert data['field']==field
    assert data['lang']=='ko'
    mock.assert_not_awaited()

def test_export_collects_product_context(client):
    data=client.post('/api/conversation',json={'query':'미국에 화장품을 수출하고 싶어요'}).json()
    assert data['field']=='details'
    assert data['context']['regions']==['FDA']

@pytest.mark.parametrize('context',[{'regions':['INVENTED']},{'regions':['FDA','MFDS','PMDA','EMA']},{'domain':'Unknown'},{'details':'x'*1601}])
def test_invalid_scope_is_rejected(client,context):
    assert client.post('/api/conversation',json={'query':'Medical device requirements','context':context}).status_code==422

def test_comparison_retains_explicit_markets_and_evidence(client,monkeypatch):
    async def fake(query,domain,region,lang):
        return dict(status='DRAFT',claims=[{'statement':'A draft statement','quote':'The actual supporting quotation','source_id':region}],sources=[{'id':region,'title':'Official document','url':'https://www.fda.gov/example','content_sha256':'abc','retrieval_status':'RETRIEVED','retrieved_at':'2026-10-16T00:00:00Z'}])
    mock=AsyncMock(side_effect=fake);monkeypatch.setattr(r,'search',mock)
    data=client.post('/api/conversation',json={'query':'Compare medical device requirements in Japan and the US','context':{'regions':['PMDA','FDA']}}).json()
    assert data['status']=='DRAFT'
    assert [g['target_region'] for g in data['groups']]==['PMDA','FDA']
    assert len(data['graph']['requirements'])==2
    assert all(d['effective_date'] is None for d in data['graph']['documents'])
    assert all(x['status']=='draft_requires_review' for x in data['graph']['requirements'])
    assert mock.await_count==2

def test_unsupported_market_has_no_generated_obligations(client,monkeypatch):
    mock=AsyncMock(return_value=dict(status='INSUFFICIENT_EVIDENCE',claims=[],sources=[]))
    monkeypatch.setattr(r,'search',mock)
    data=client.post('/api/conversation',json={'query':'중국 화장품 요건'}).json()
    assert data['status']=='EVIDENCE_LIMITED'
    assert not data['graph']['requirements']

def test_unreferenced_claim_not_added_to_graph():
    graph=build_graph([{'target_region':'FDA','sources':[],'claims':[{'source_id':'missing','statement':'Unsupported','quote':'Not retrieved'}]}])
    assert not graph['requirements']

def test_indices_are_not_used_as_substantive_law(monkeypatch):
    monkeypatch.setenv('GROQ_API_KEY','not-used')
    async def index(client,source):
        return {**source,'text':'Directory of regulations. '*30,'retrieval_status':'RETRIEVED'}
    monkeypatch.setattr(r,'fetch_source',index)
    result=asyncio.run(r.search('의료기기','Medical Devices','MFDS','ko'))
    assert not result['claims']
    assert result['status']=='SOURCE_UNAVAILABLE'

def test_iso_not_fetched_and_coverage_honest(client):
    data=client.get('/api/coverage').json()
    assert data['iso_full_text']=='licence_required_not_ingested'
    assert data['coverage']=='partial'
    assert not any('iso.org' in s['url'] for s in data['sources'])
