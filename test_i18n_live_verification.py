import sys
import httpx
import json

sys.path.insert(0, ".")
from engine.audit_engine import audit_engine

print("=== 1. AUDIT ENGINE DIRECT VERIFICATION ===")
regions = ['MFDS', 'FDA', 'EMA', 'PMDA', 'WHO']
langs = ['ko', 'en', 'ja', 'zh', 'de']

total_checks = 0
for r in regions:
    for l in langs:
        res = audit_engine.diagnose_gmp_gaps({
            'product_name': f'GlobalDrug-{r}',
            'batch_size': '50000 Vials',
            'has_hbel_pde': False,
            'process_validation_age': 4,
            'hvac_status': 'COMPLIANT',
            'target_region': r
        }, lang=l)
        assert res['health_score'] == 45
        assert len(res['gaps']) == 2
        total_checks += 1

print(f"SUCCESS: Executed {total_checks} direct AuditEngine validations across 5 regions and 5 languages successfully!")

print("\n=== 2. FASTAPI LIVE ENDPOINT VERIFICATION ===")
mcp_res = httpx.get('http://localhost:8000/api/mcp/status').json()
print("FastAPI MCP Status:", mcp_res['status'])
print("Supported Languages:", mcp_res['supported_languages'])
print("Supported Regions:", mcp_res['supported_regions'])

test_post = httpx.post('http://localhost:8000/api/audit/diagnose', json={
    'product_name': 'TestGlobal 100mg',
    'batch_size': '10000 Vials',
    'has_hbel_pde': False,
    'process_validation_age': 4,
    'hvac_status': 'COMPLIANT',
    'target_region': 'FDA',
    'lang': 'en'
})

assert test_post.status_code == 200
post_data = test_post.json()
print("Live REST API Target Region:", post_data['target_region'])
print("Live REST API Health Score:", post_data['health_score'])
print("Live REST API Gaps Count:", post_data['gap_count'])
print("Live REST API Language:", post_data['lang'])
print("\nALL VERIFICATIONS PASSED 100% SUCCESS!")
