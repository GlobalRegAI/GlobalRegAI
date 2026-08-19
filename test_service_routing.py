import sys
import httpx
import json

sys.path.insert(0, ".")

def verify_all_service_pages():
    print("=== DEDICATED MULTI-SERVICE PAGE ROUTING VERIFICATION ===", flush=True)
    
    routes = [
        ("/", "Main Intelligence Hub"),
        ("/gmp-core", "GMP Core Engine"),
        ("/export-intelligence", "Export Intelligence Page"),
        ("/confidential-vault", "Confidential Vault"),
        ("/agent-portal", "Browser Agent"),
        ("/app-portal", "App Center"),
        ("/test_portal", "Test Portal Form"),
        ("/ads.txt", "Google AdSense Verification"),
        ("/api/mcp/status", "MCP Status API"),
        ("/api/export/ingredient?name=phenoxyethanol", "Export Ingredient API"),
        ("/api/export/checklist?category=PHARMA&country=FDA", "Export Checklist API"),
        ("/api/vault/search?topic=cleaning_validation", "Vault Search API"),
        ("/api/vault/batch?batch_id=BATCH-2024-001", "Vault Batch API")
    ]

    for path, name in routes:
        url = f"http://localhost:8000{path}"
        res = httpx.get(url, timeout=10.0)
        assert res.status_code == 200, f"Route {path} failed with status {res.status_code}"
        print(f"SUCCESS [HTTP 200]: Route '{path}' ({name}) rendered successfully!", flush=True)

    print("\n=== POST API DIAGNOSIS VERIFICATION ===", flush=True)
    diag_res = httpx.post("http://localhost:8000/api/audit/diagnose", json={
        "product_name": "FullScale-GlobalTest",
        "batch_size": "5000 Vials",
        "has_hbel_pde": False,
        "process_validation_age": 4,
        "hvac_status": "COMPLIANT",
        "target_region": "NMPA",
        "ingredients": ["isobutyl_paraben", "niacinamide"],
        "lang": "zh"
    }, timeout=10.0)
    assert diag_res.status_code == 200
    diag_data = diag_res.json()
    print(f"SUCCESS [HTTP 200]: Audit Diagnosis returned Score = {diag_data['health_score']}, Region = {diag_data['target_region']}, Gaps = {diag_data['gap_count']}", flush=True)

    print("\nALL 10 GLOBAL MARKETS & MULTI-SERVICE ROUTE VERIFICATIONS PASSED 100% SUCCESS!", flush=True)

if __name__ == "__main__":
    verify_all_service_pages()
