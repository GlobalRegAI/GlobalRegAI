"""Evidence collection for GMP review, not a certification or compliance scoring system."""
from datetime import datetime, timezone

REGULATORY_STANDARDS = {k: {'name': v} for k, v in {
    'FDA': 'United States', 'EMA': 'European Union', 'MFDS': 'South Korea',
    'PMDA': 'Japan', 'NMPA': 'China', 'MHRA': 'United Kingdom'}.items()}
PRODUCT_CATEGORIES = ['PHARMA', 'COSMETIC', 'DEVICE', 'SANITIZER', 'FOOD', 'CHEMICAL']


class SeniorLeadAuditorEngine:
    def diagnose_gmp_gaps(self, payload, lang='en'):
        cv = payload.get('cleaning_validation_report', {}).get('has_hbel_pde')
        pv = payload.get('process_validation_report', {}).get('age_years')
        hvac = payload.get('hvac_em_report', {}).get('status', 'UNKNOWN')
        ko = lang == 'ko'
        items = [
            {'topic': 'Cleaning validation', 'reported': cv,
             'status': 'DOCUMENT_REVIEW_REQUIRED' if cv else 'EVIDENCE_REQUIRED',
             'action': '적용 제품·공용 설비·독성평가 자료와 세척 검증 근거를 검토하십시오.' if ko else 'Review product scope, shared-equipment risks, toxicological assessment and the approved cleaning validation evidence.'},
            {'topic': 'Process validation', 'reported_age_years': pv, 'status': 'DOCUMENT_REVIEW_REQUIRED',
             'action': '경과 연수만으로 부적합을 판정하지 않습니다. 변경관리·추세·지속적 공정 검증·승인된 절차를 검토하십시오.' if ko else 'Age alone cannot establish non-compliance. Review changes, trends, continued verification and the approved site procedure before deciding whether revalidation is needed.'},
            {'topic': 'Environmental controls', 'reported': hvac, 'status': 'DOCUMENT_REVIEW_REQUIRED',
             'action': '환경 모니터링·설비 적격성평가·일탈 자료를 검토하십시오.' if ko else 'Review monitoring trends, qualification records, deviations and product-specific environmental requirements.'}
        ]
        return {'status': 'REVIEW_REQUIRED', 'product_name': payload.get('product_name'),
                'target_region': payload.get('target_region'), 'checks': items,
                'message': '입력 내용에 기반한 검토 목록입니다. 문서 검증이나 적합성 판정은 수행하지 않았습니다.' if ko else 'Review checklist based on self-reported inputs. Documents have not been verified and compliance has not been determined.',
                'health_score': None, 'alcoa_data_integrity_index': None, 'audit_ready': False,
                'generated_at': datetime.now(timezone.utc).isoformat()}


audit_engine = SeniorLeadAuditorEngine()
