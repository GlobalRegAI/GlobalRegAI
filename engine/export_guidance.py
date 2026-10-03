"""Reviewed explanations for common routes, with explicit product-specific limits."""
EU_GUIDE = 'https://health.ec.europa.eu/document/download/88eff4e3-9763-435e-a3b9-75aadfc8df65_en?filename=md_manufacturers_factsheet_en.pdf'
EU_OVERVIEW = 'https://health.ec.europa.eu/medical-devices-new-regulations/overview_en'
DEVICE_EU = {
    'ko': [
        '적용 규정부터 구분합니다. 일반 의료기기는 MDR, 체외진단 의료기기는 IVDR을 검토합니다. 아래 내용은 일반 의료기기 제조업체의 MDR 준비 안내이며, 체외진단·맞춤형 기기 등의 별도 요건을 모두 포함하지 않습니다.',
        '사용 목적과 위험등급을 정리합니다. 제품 설명, 대상 환자, 사용 부위·기간, 침습성, 작동 방식 등을 기록하고 MDR 부속서 VIII의 분류 규칙에 연결합니다. 분류 근거를 문서화해야 후속 적합성 평가 경로를 정할 수 있습니다.',
        '기술문서를 준비합니다. 부속서 I의 일반 안전·성능 요구사항에 대해 적용 여부와 근거를 정리하고, 부속서 II·III에 따라 제품 설명, 설계·제조 정보, 위험관리, 검증·검증시험, 임상평가 및 시판 후 감시 자료를 구성합니다. 임상평가는 모든 제품에 동일한 시험을 요구한다는 뜻이 아니며 제품별 근거와 예외를 검토해야 합니다.',
        '품질시스템과 책임자를 마련합니다. 제10조의 품질경영·위험관리 의무 및 제15조의 규제 준수 책임자 요건을 검토합니다. EU/EEA 밖의 제조업체는 제11조에 따른 역내 공인대리인 계약도 준비합니다.',
        '등급에 맞는 적합성 평가를 진행합니다. 제52조에 따라 IIa·IIb·III와 일부 I등급은 인증기관 참여가 필요합니다. I등급이라도 멸균·측정 기능·재사용 수술기구는 관련 범위의 심사가 필요합니다. 의무를 충족한 뒤 EU 적합성 선언과 CE 표시를 준비합니다. 등급·제품 정보를 모르는 상태에서는 인증 필요 여부를 확정할 수 없습니다.',
        '출시 이후까지 준비합니다. UDI·등록, 시판 후 감시 및 안전성 보고 체계를 갖추고 대상 회원국의 언어 요건과 적용 시점을 확인합니다. 기존 인증의 전환기간과 EUDAMED 의무는 제품 및 단계에 따라 달라 최신 집행위원회 안내를 별도로 확인해야 합니다.',
    ],
    'en': [
        'Distinguish MDR medical devices from IVDR in vitro diagnostic devices. This outline covers MDR manufacturer preparation; special cases such as custom-made devices require additional review.',
        'Document intended purpose, patient population, duration and site of use, invasiveness and operating principle. Map these to Annex VIII classification rules and record the rationale before choosing a conformity assessment route.',
        'Build technical documentation under Annexes II and III, including device description, design and manufacturing, risk management, verification and validation, clinical evaluation and post-market surveillance. Map evidence to applicable Annex I safety and performance requirements. Clinical evidence requirements and exceptions depend on the device.',
        'Establish quality and risk management under Article 10 and review the regulatory compliance person requirements in Article 15. Manufacturers outside the EU/EEA also need an authorised representative under Article 11.',
        'Apply the Article 52 conformity assessment route. Classes IIa, IIb and III and certain class I devices require a notified body. Sterile, measuring and reusable surgical class I devices require involvement for the relevant aspects. Prepare the declaration of conformity and CE marking after meeting applicable obligations.',
        'Plan UDI, registration, post-market surveillance and vigilance. Check member-state language requirements, current EUDAMED rollout and any transitional conditions separately. Device details are needed to establish the applicable deadlines.',
    ]}


def device_eu(lang):
    ko = lang == 'ko'
    return {'status': 'PLANNING_ONLY', 'product_category': 'DEVICE', 'target_country': 'EMA',
            'checklist': DEVICE_EU['ko' if ko else 'en'],
            'message': ('일반 의료기기의 EU 시장 진입 준비 내용입니다. 제품명·사용 목적·위험등급·기존 인증 상태를 알려 주시면 더 구체적인 질문을 검토할 수 있습니다. 아래 2020년 PDF의 전환기한은 개정되었으므로 현재 기한으로 사용하지 마세요.' if ko else
                        'MDR preparation guidance, not a market eligibility decision. Provide intended purpose, classification and existing certificate details for a more specific assessment. Transitional dates in the 2020 PDF have since changed; do not use them as current deadlines.'),
            'sources': [
                {'id': 'eu-current', 'title': 'EU — '+('현행 규정·개정 안내' if ko else 'Regulations and amendments'), 'url': EU_OVERVIEW, 'catalogue_reviewed_at': '2026-10-03'},
                {'id': 'eu-guide', 'title': 'EU — '+('제조업체 설명서 PDF (2020년판·전환기한 변경 주의)' if ko else 'Manufacturer factsheet PDF (2020; transitional dates superseded)'), 'url': EU_GUIDE, 'format': 'PDF', 'catalogue_reviewed_at': '2026-10-03'}]}


def cosmetics_fda(lang):
    ko = lang == 'ko'
    return {'status':'PLANNING_ONLY','product_category':'COSMETIC','target_country':'FDA',
            'message': 'MoCRA의 주요 준비 항목입니다. 소기업 면제는 조건부이며 제품별 적용 여부를 확인해야 합니다. 전체 수입·표시 요건을 모두 검토한 결과는 아닙니다.' if ko else 'Key MoCRA preparation items. Small-business exemptions are conditional. This is not a complete import or labelling assessment.',
            'checklist': ([
                '시설 등록 대상인 제조·가공업체는 FDA 등록과 2년 주기 갱신을 준비합니다. 책임자는 판매되는 제품의 성분 정보를 포함해 제품 목록을 제출하고 매년 갱신합니다. 먼저 해당 시설·제품의 면제 여부를 확인하세요.',
                '특정 소기업은 GMP·시설 등록·제품 목록 의무에서 면제될 수 있습니다. 그러나 통상 사용 시 눈의 점막에 접촉하는 제품, 주입 제품, 체내 사용 제품, 또는 외관을 24시간 넘게 바꾸면서 통상 사용에 소비자의 제거가 포함되지 않는 제품은 이 소기업 면제를 적용할 수 없습니다.',
                '제품 안전성을 뒷받침하는 과학적 근거와 기록을 준비·유지합니다. 특정 시험법이 일률적으로 요구되지 않는다는 것이 안전성 자료가 불필요하다는 뜻은 아닙니다.',
                '책임자는 미국 내 사용과 관련된 중대한 이상사례를 15영업일 이내에 보고할 체계를 준비해야 합니다. 소기업 등록 면제를 모든 의무의 면제로 해석하지 마세요.'
            ] if ko else [
                'Where registration applies, manufacturers and processors register facilities and renew every two years. Responsible persons list marketed products, including ingredients, and update annually. Establish exemption eligibility first.',
                'Certain small businesses qualify for GMP, registration and listing exemptions. These do not cover products contacting eye mucous membranes under usual use, injected or internally used products, or products altering appearance for more than 24 hours with no customary consumer removal.',
                'Maintain scientifically robust safety substantiation records. Absence of a prescribed test does not remove the safety obligation.',
                'Prepare serious adverse event reporting within 15 business days. Do not treat a registration exemption as exemption from all obligations.'
            ]), 'sources':[{'id':'fda-mocra','title':'FDA — MoCRA','url':'https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra','catalogue_reviewed_at':'2026-10-03'}]}
