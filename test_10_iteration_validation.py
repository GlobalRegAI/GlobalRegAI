import sys
import os
import time
import httpx

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def run_10_iteration_structural_verification():
    print("=======================================================================", flush=True)
    print("=== STARTING 10-ITERATION FULL STRUCTURAL & COMPLIANCE VERIFICATION ===", flush=True)
    print("=======================================================================", flush=True)

    client = httpx.Client(base_url="http://localhost:8000", follow_redirects=True, timeout=10.0)

    routes_to_test = [
        ("/", "Main Intelligence Hub"),
        ("/gmp-core", "GMP Core Gap Evaluator"),
        ("/export-intelligence", "Export Regulatory Inspector"),
        ("/certification/translate", "Certification Translator Portal"),
        ("/confidential-vault", "Confidential Data Vault Inspector"),
        ("/agent-portal", "Browser Agent Submission Guide"),
        ("/developer-console", "Developer Admin Cockpit"),
        ("/ads.txt", "Google AdSense Verification File"),
        ("/api/mcp/status", "FastMCP System Telemetry API")
    ]

    total_passed = 0
    total_failed = 0

    for iteration in range(1, 11):
        print(f"\n--- ITERATION {iteration}/10 IN PROGRESS ---", flush=True)
        iteration_success = True

        for route, name in routes_to_test:
            try:
                res = client.get(route)
                if res.status_code == 200:
                    pass
                else:
                    print(f"❌ Iteration {iteration} FAILED on {route}: HTTP {res.status_code}", flush=True)
                    iteration_success = False
            except Exception as e:
                print(f"❌ Iteration {iteration} ERROR on {route}: {e}", flush=True)
                iteration_success = False

        # Test POST API /api/translate
        try:
            trans_res = client.post("/api/translate", json={
                "text": "Cleaning validation protocol requires HBEL toxicological limits.",
                "target_lang": "ko"
            })
            if trans_res.status_code != 200:
                print(f"❌ Iteration {iteration} FAILED on POST /api/translate", flush=True)
                iteration_success = False
        except Exception as e:
            print(f"❌ Iteration {iteration} ERROR on POST /api/translate: {e}", flush=True)
            iteration_success = False

        # Test POST API /api/audit/diagnose
        try:
            audit_res = client.post("/api/audit/diagnose", json={
                "product_name": f"IterProduct_{iteration}",
                "batch_size": "50,000 Vials",
                "has_hbel_pde": False,
                "process_validation_age": 4,
                "target_region": "MFDS",
                "lang": "ko"
            })
            if audit_res.status_code != 200:
                print(f"❌ Iteration {iteration} FAILED on POST /api/audit/diagnose", flush=True)
                iteration_success = False
        except Exception as e:
            print(f"❌ Iteration {iteration} ERROR on POST /api/audit/diagnose: {e}", flush=True)
            iteration_success = False

        if iteration_success:
            print(f"✅ ITERATION {iteration}/10: ALL ROUTES & APIs PASSED HTTP 200 CLEAN!", flush=True)
            total_passed += 1
        else:
            total_failed += 1

    print("\n=======================================================================", flush=True)
    print(f"=== 10-ITERATION SUMMARY: {total_passed}/10 ITERATIONS PASSED PERFECTLY ===", flush=True)
    print("=======================================================================", flush=True)

    assert total_failed == 0, f"Verification failed with {total_failed} errors."

if __name__ == "__main__":
    run_10_iteration_structural_verification()
