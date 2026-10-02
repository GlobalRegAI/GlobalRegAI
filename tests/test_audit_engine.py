from engine.audit_engine import audit_engine


def test_old_validation_is_not_automatically_noncompliant():
    result = audit_engine.diagnose_gmp_gaps({'product_name':'Test product', 'target_region':'FDA',
        'cleaning_validation_report': {'has_hbel_pde': True},
        'process_validation_report': {'age_years': 4}})
    assert result['status'] == 'REVIEW_REQUIRED'
    assert result['health_score'] is None
    assert result['alcoa_data_integrity_index'] is None
    assert result['audit_ready'] is False
    assert all(c['status'] != 'COMPLIANT' for c in result['checks'])
    assert 'Age alone' in result['checks'][1]['action']


def test_hvac_deviation_remains_visible_and_no_root_cause_is_invented():
    result = audit_engine.diagnose_gmp_gaps({'hvac_em_report':{'status':'DEVIATION'}})
    assert result['checks'][2]['reported'] == 'DEVIATION'
    assert 'auditor_rca' not in str(result)
