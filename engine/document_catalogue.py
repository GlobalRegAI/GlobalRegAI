"""Specific official files, checked against publisher pages on 2026-10-03."""
FORMS = {
    '356h': {
        'url': 'https://www.fda.gov/media/72649/download',
        'instructions': 'https://www.fda.gov/media/84223/download',
        'ko': 'FDA 356h는 인체용 신약·제네릭 의약품·생물학적 제제의 판매허가 신청에 사용하는 서식입니다. 신청인, 제품, 신청 유형, 제출 자료와 책임자 정보를 기재합니다. 이 서식만 제출한다고 허가가 완료되지는 않습니다. 아래 원본 PDF와 작성 지침을 함께 확인하세요.',
        'en': 'FDA 356h accompanies marketing applications for human drugs and biologics. It records applicant, product, application type, supporting materials and responsible official information. Completing this form alone does not establish approval. Download the original PDF and its instructions below.'},
    '1571': {
        'url': 'https://www.fda.gov/media/123543/download',
        'ko': 'FDA 1571은 임상시험용 신약 신청(IND)에 사용하는 서식입니다. 의뢰자, 시험 의약품, 제출 유형 및 관련 자료를 식별합니다. 판매허가 신청서 356h와 용도가 다르며, 이 양식만으로 임상시험 개시가 허용되는 것은 아닙니다.',
        'en': 'FDA 1571 is the Investigational New Drug (IND) application form. It identifies the sponsor, investigational drug, submission type and accompanying materials. It serves a different purpose from marketing form 356h; the form alone does not authorise starting a trial.'},
}


def form_documents(number, lang):
    form = FORMS[number]
    items = [{'id': 'fda-'+number, 'title': 'FDA '+number+' — '+('원본 서식 PDF' if lang == 'ko' else 'Original form PDF'),
              'url': form['url'], 'format': 'PDF', 'retrieval_status': 'VERIFIED_FILE_LINK',
              'catalogue_reviewed_at': '2026-10-03'}]
    if form.get('instructions'):
        items.append({**items[0], 'id': 'fda-'+number+'-instructions',
                      'title': 'FDA '+number+' — '+('작성 지침 PDF' if lang == 'ko' else 'Instructions PDF'),
                      'url': form['instructions']})
    return items
