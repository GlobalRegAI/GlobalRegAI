"""Deterministic navigation before evidence synthesis. No invented forms or contacts."""
import re
from engine import regulatory_search as research

DOCUMENTS = {
    'FDA': ('FDA — Forms and updates', 'https://www.fda.gov/about-fda/forms/new-and-updated-fda-forms'),
    'MFDS': ('식약처 — 민원편람', 'https://www.mfds.go.kr/brd/m_1208/list.do'),
}
CONTACTS = {
    'FDA': ('FDA — Contact a product office', 'https://www.fda.gov/about-fda/contact-fda'),
    'MFDS': ('식약처 — 통합상담예약', 'https://www.mfds.go.kr/usr/tCounsel_1024/list.do'),
}
EU_DEVICES = ('European Commission — Medical device authorities and notified bodies',
              'https://health.ec.europa.eu/medical-devices-sector/new-regulations/contacts_en')
REGION_PATTERNS = {
    'FDA': r'\bfda\b|\bunited states\b|\busa\b|미국',
    'MFDS': r'\bmfds\b|\bkorea\b|식약처|한국',
    'EMA': r'\beu\b|\bema\b|\bmdr\b|\bivdr\b|유럽',
    'MHRA': r'\bmhra\b|\buk\b|영국',
    'PMDA': r'\bpmda\b|\bjapan\b|일본',
    'NMPA': r'\bnmpa\b|\bchina\b|중국',
}


def result(status, message, region, sources=None, choices=None):
    return dict(status=status, route=status, message=message, target_region=region,
                claims=[], sources=sources or [], choices=choices or [],
                interpretation_verified=False, llm_used=False)


def link(item, ident):
    return dict(id=ident, title=item[0], url=item[1], retrieval_status='DIRECTORY_LINK',
                catalogue_reviewed_at='2026-10-01', effective_date=None)


def clarify(region, lang, regions=None):
    labels = research.REGIONS
    return result('CLARIFICATION_REQUIRED',
        '대상 국가를 선택해 주세요. 기존 질문은 유지됩니다.' if lang == 'ko' else
        'Choose the target jurisdiction. Your original question is retained.', region,
        choices=[dict(label=labels[r], target_region=r) for r in (regions or labels) if r != 'ALL'])


async def answer(query, domain, region, lang):
    q = query.lower()
    mentioned = [r for r, pattern in REGION_PATTERNS.items() if re.search(pattern, q)]
    # Explicit selector wins when multiple markets are compared; never silently override it.
    if region == 'ALL' and len(mentioned) == 1:
        region = mentioned[0]
    contact = bool(re.search(r'\bcontact\b|\bphone\b|\bemail\b|\be-mail\b|담당.*(?:기관|부서)|전화|이메일|상담원|상담예약|기관.*문의', q))
    document = bool(re.search(r'\bdownload\b|\bforms?\b|\bwhere.*(?:document|template)\b|서식|양식|다운로드|서류.*(?:주세요|어디|받|필요)', q))
    form356h = bool(re.search(r'(?<![a-z0-9])356h(?![a-z0-9])', q))
    if re.search(r'how.*(?:complete|fill|apply)|작성.*(?:방법|어떻게)|적용.*(?:여부|되는)', q):
        document = False
    if (contact or document) and len(mentioned) == 1 and region != mentioned[0]:
        return result('SCOPE_CONFLICT',
            '질문의 국가와 선택한 국가가 다릅니다. 아래 국가를 선택하거나 질문을 수정해 주세요.' if lang == 'ko' else
            'The question and selected jurisdiction differ. Choose the jurisdiction below or edit the question.', region,
            choices=[dict(label=research.REGIONS[mentioned[0]], target_region=mentioned[0])])
    if form356h and (document or q.strip() in ('356h', 'fda 356h')):
        if region not in ('ALL', 'FDA'):
            return result('SCOPE_CONFLICT', 'FDA Form 356h is a US form. Select United States to locate it.', region,
                          choices=[dict(label='United States', target_region='FDA')])
        return result('DOCUMENT_LINKS',
            'FDA 공식 페이지에서 Form 356h의 현재 서식과 개정 안내를 확인하세요. 적용 여부는 별도 확인이 필요합니다.' if lang == 'ko' else
            'Open the FDA page for Form 356h and revision information. Applicability must be checked separately.',
            'FDA', [link(DOCUMENTS['FDA'], 'fda-356h')])
    if contact or document:
        if region == 'ALL':
            return clarify(region, lang, mentioned or None)
        items = CONTACTS if contact else DOCUMENTS
        item = items.get(region)
        is_device = domain == 'Medical Devices' or bool(re.search(r'\bmdr\b|\bivdr\b|medical device|의료기기', q))
        if region == 'EMA' and is_device and contact:
            item = EU_DEVICES
        if item:
            message = ('공식 안내 페이지입니다. 해당 제품과 업무를 선택해 최신 서류 또는 담당 부서를 확인하세요. 문의가 자동 발송되지는 않습니다.' if lang == 'ko' else
                       'Use the official directory to select your product and procedure. No inquiry has been sent.')
            if item == EU_DEVICES:
                message += (' MDR은 규정입니다. 회원국 관할 기관과 인증기관의 역할을 구분하고 대상 회원국을 확인하세요.' if lang == 'ko' else
                            ' MDR is a regulation. Select the member state and distinguish the competent authority from the notified body.')
            return result('AGENCY_CONTACT' if contact else 'DOCUMENT_LINKS', message, region,
                          [link(item, region.lower() + '-directory')])
        return result('NOT_COVERED',
            '이 국가·분야의 공식 안내 목록은 아직 확인되지 않았습니다. 서류명·제품 종류·담당 기관을 구체적으로 입력해 주세요.' if lang == 'ko' else
            'This jurisdiction and topic are not covered by the verified directory yet. Specify the document, product and responsible authority.', region)
    response = await research.search(query, domain, region, lang)
    response['route'] = 'GROUNDED_RESEARCH'
    response['target_region'] = region
    return response
