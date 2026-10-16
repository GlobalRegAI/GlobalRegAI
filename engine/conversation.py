"""Progressive clarification over bounded, validated client-held context."""
import asyncio
import re
from pydantic import BaseModel, Field, field_validator
from engine import regulatory_search as research
from engine.question_router import REGION_PATTERNS
from engine.regulatory_graph import build_graph

REGION_PATTERNS = {**REGION_PATTERNS,
    'SFDA': r'\bsfda\b|\bsaudi\b|사우디', 'ANVISA': r'\banvisa\b|\bbrazil\b|브라질'}
DOMAIN_PATTERNS = {
    'Medical Devices': r'medical device|\bivd\b|\bmdr\b|\bivdr\b|510\(k\)|의료기기|체외진단',
    'Cosmetics': r'cosmetic|\bmocra\b|화장품|스킨케어',
    'Food Safety': r'\bfood\b|supplement|collagen jelly|식품|젤리|건강기능|영양제',
    'Pharmaceuticals': r'\bdrug\b|pharma|medicine|의약품|의약|원료의약',
    'Plants & Phytosanitary': r'\bplant\b|\bplants\b|\bseed\b|phytosanitary|식물|종자',
    'Animal & Veterinary': r'\banimal\b|veterinary|livestock|동물|축산|사료',
    'Standards & QMS': r'\biso\b|\b13485\b|\bgmp\b|\bcgmp\b|\bqms\b|품질경영',
    'Chemicals': r'chemical|\breach\b|화학',
    'Certification': r'accreditation|certification body|인정기관|인증기관',
}
KO_DOMAINS = dict(zip(research.DOMAINS, ['의약품','의료기기·체외진단','화장품','식품·건강기능식품','화학물질','동물·동물용 제품','식물·검역','표준·품질시스템','인증·인정']))
KO_REGIONS = {'FDA':'미국','EMA':'유럽연합','MFDS':'한국','PMDA':'일본','NMPA':'중국','MHRA':'영국','SFDA':'사우디아라비아','ANVISA':'브라질'}

class Context(BaseModel):
    domain: str | None = None
    regions: list[str] = Field(default_factory=list, max_length=3)
    details: str = Field(default='', max_length=1600)
    @field_validator('domain')
    @classmethod
    def valid_domain(cls, value):
        if value is not None and value not in research.DOMAINS:
            raise ValueError('Unsupported product category')
        return value
    @field_validator('regions')
    @classmethod
    def valid_regions(cls, value):
        if any(r not in research.REGIONS or r == 'ALL' for r in value):
            raise ValueError('Unsupported market')
        return list(dict.fromkeys(value))

class ConversationPayload(BaseModel):
    query: str = Field(min_length=3, max_length=2400)
    context: Context = Field(default_factory=Context)
    lang: str = 'auto'
    @field_validator('lang')
    @classmethod
    def valid_lang(cls, value):
        if value not in ('auto', *research.LANGUAGES):
            raise ValueError('Unsupported language')
        return value
    @field_validator('query')
    @classmethod
    def nonblank(cls, value):
        if len(value.strip()) < 3:
            raise ValueError('Enter at least 3 characters')
        return value.strip()


def clarification(context, lang, field, message, choices):
    return {'status':'CLARIFICATION_REQUIRED','context':context.model_dump(),'lang':lang,
            'field':field,'message':message,'choices':choices,'groups':[]}


async def answer(payload):
    context = payload.context.model_copy(deep=True)
    query = payload.query
    q = query.lower()
    lang = payload.lang if payload.lang != 'auto' else ('ko' if re.search('[가-힣]',query) else 'en')
    ko = lang == 'ko'
    if not context.domain:
        matches = [d for d,p in DOMAIN_PATTERNS.items() if re.search(p,q)]
        product_matches = [d for d in matches if d not in ('Standards & QMS', 'Certification')]
        if len(product_matches) == 1:
            context.domain = product_matches[0]
        elif len(matches) == 1:
            context.domain = matches[0]
    if not context.domain:
        return clarification(context,lang,'domain', '어떤 종류의 제품 또는 업무인가요?' if ko else 'What kind of product or work is this?',
            [{'label':KO_DOMAINS[d] if ko else d,'value':d} for d in research.DOMAINS])
    if not context.regions:
        detected = [r for r,p in REGION_PATTERNS.items() if re.search(p,q)]
        if len(detected) == 1:
            context.regions = detected
        else:
            # Multiple country mentions may describe origin, destination or comparison.
            # Do not silently treat the manufacturing country as a target market.
            labels = KO_REGIONS if ko else research.REGIONS
            return clarification(context,lang,'regions',
                '규정을 확인할 대상 시장을 선택해 주세요. 최대 3개를 비교할 수 있습니다.' if ko else 'Which markets should we assess? Choose up to 3 to compare.',
                [{'label':labels[r],'value':r,'suggested':r in detected} for r in research.REGIONS if r != 'ALL'])
    needs_product = re.search(r'export|import|market access|sell|수출|수입|판매|우리 제품|my product',q)
    if needs_product and not context.details:
        return clarification(context,lang,'details',
            '제품명·성분 또는 재질·사용 목적·제조국을 간단히 알려주세요. 모르는 항목은 생략해도 됩니다.' if ko else 'Briefly describe the product, ingredients or materials, intended use and country of manufacture. Leave unknown details out.', [])
    expanded = query + ('\nProduct context: '+context.details if context.details else '')
    async def one(region):
        response = await research.search(expanded, context.domain, region, lang)
        response['target_region'] = region
        response['market_label'] = (KO_REGIONS if ko else research.REGIONS)[region]
        return response
    groups = await asyncio.gather(*(one(r) for r in context.regions))
    graph = build_graph(groups)
    has_claims = any(g.get('claims') for g in groups)
    return {'status':'DRAFT' if has_claims else 'EVIDENCE_LIMITED','context':context.model_dump(),'lang':lang,
        'message': ('공식 자료를 바탕으로 정리했습니다. 적용 조건과 원문을 함께 확인하세요.' if ko else 'Here is the available official evidence. Check its scope alongside the source.') if has_claims else
                   ('현재 확보한 자료로는 이 질문의 요건을 확정할 수 없습니다.' if ko else 'The available evidence does not establish the requirements for this question.'),
        'groups':groups,'graph':graph,
        'review_topics': ['classification','market_access','documents','labelling','quality_system','post_market'],
        'limitations': {'coverage':'partial','equivalence':'not_assessed','effective_dates':'unverified','change_monitoring':'not_connected','translation':'AI draft; not certified'}}
