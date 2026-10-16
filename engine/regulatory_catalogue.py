"""Curated source connectors. A catalogue entry is not a verified legal requirement."""
EXTRA_REGIONS = {'SFDA': 'Saudi Arabia', 'ANVISA': 'Brazil'}
EXTRA_SOURCES = [
    ('jp-device', 'PMDA / MHLW — Medical device regulation', 'PMDA', ['Medical Devices', 'Standards & QMS', 'Certification'], ['medical device','device','医療機器','의료기기','허가','approval','qms'], 'https://www.pmda.go.jp/english/review-services/reviews/0004.html', 'guidance', 'agency_reference_translation'),
    ('jp-qms', 'PMDA — Medical device QMS requirements', 'PMDA', ['Medical Devices','Standards & QMS'], ['qms','13485','gmp','품질'], 'https://www.pmda.go.jp/english/review-services/regulatory-info/0004.html', 'guidance', 'agency_reference_translation'),
    ('jp-gmp', 'PMDA — GMP compliance inspection', 'PMDA', ['Pharmaceuticals','Standards & QMS'], ['gmp','drug','의약품','inspection','실사','제조'], 'https://www.pmda.go.jp/english/review-services/gmp-qms-gctp/0001.html', 'guidance', 'agency_reference_translation'),
    ('kr-device-index', 'MFDS — Medical device regulations and documents', 'MFDS', ['Medical Devices','Standards & QMS','Certification'], ['device','gmp','의료기기','허가','서류','regulation'], 'https://www.mfds.go.kr/eng/brd/m_40/list.do', 'document_index', 'agency_reference_translation'),
    ('kr-cosmetic-index', 'MFDS — Cosmetics regulations and documents', 'MFDS', ['Cosmetics'], ['cosmetic','화장품','등록','서류','regulation'], 'https://www.mfds.go.kr/eng/brd/m_28/list.do', 'document_index', 'agency_reference_translation'),
    ('sa-regulations', 'SFDA — Laws and regulations', 'SFDA', ['Medical Devices','Pharmaceuticals','Cosmetics','Food Safety','Standards & QMS'], ['sfda','regulation','허가','등록','device','drug','food','cosmetic','의료기기','의약품','식품','화장품'], 'https://www.sfda.gov.sa/en/regulations', 'document_index', 'agency_reference_translation'),
    ('br-device', 'ANVISA — Medical device regulation', 'ANVISA', ['Medical Devices','Certification'], ['anvisa','device','registration','approval','의료기기','등록','허가'], 'https://www.gov.br/anvisa/en/regulation-of-products/medical-devices', 'guidance', 'agency_reference_translation'),
    ('br-gmp', 'ANVISA — Company regulation and GMP', 'ANVISA', ['Medical Devices','Pharmaceuticals','Standards & QMS'], ['gmp','manufacturing','inspection','제조','실사','인증'], 'https://www.gov.br/anvisa/en/regulation-of-companies', 'guidance', 'agency_reference_translation'),
    ('uk-plants', 'DEFRA / APHA — Import plants into Great Britain', 'MHRA', ['Plants & Phytosanitary'], ['plant','seed','import','식물','종자','수입','검역','수출'], 'https://www.gov.uk/guidance/import-plants-and-plant-products-from-non-eu-countries-to-great-britain', 'guidance', 'original'),
    ('uk-animals', 'DEFRA / APHA — Import animals and animal products', 'MHRA', ['Animal & Veterinary'], ['animal','import','동물','축산','수입','검역','수출'], 'https://www.gov.uk/guidance/importing-live-animals-or-animal-products-from-non-eu-countries', 'guidance', 'original'),
    ('eu-device-guidance', 'European Commission — MDCG guidance and language requirements', 'EMA', ['Medical Devices','Certification'], ['mdcg','language','translation','document','서류','번역','언어'], 'https://health.ec.europa.eu/medical-devices-sector/new-regulations/guidance-mdcg-endorsed-documents-and-other-guidance_en', 'document_index', 'original'),
    ('fda-cgmp', 'FDA — Drug CGMP regulations', 'FDA', ['Pharmaceuticals','Standards & QMS'], ['cgmp','gmp','drug','의약품','제조'], 'https://www.fda.gov/drugs/pharmaceutical-quality-resources/current-good-manufacturing-practice-cgmp-regulations', 'guidance', 'original'),
]


def sources():
    return [dict(id=i, title=t, region=r, domains=d, keywords=k, url=u,
                 document_type=kind, translation_status=translation,
                 rights_status='public_official_page', effective_date_status='unverified')
            for i,t,r,d,k,u,kind,translation in EXTRA_SOURCES]
