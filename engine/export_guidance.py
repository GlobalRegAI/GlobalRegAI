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
