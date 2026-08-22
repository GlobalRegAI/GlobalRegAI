import sys
import os
import httpx
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def test_50_year_lead_auditor_features():
    print("=== TESTING 50-YEAR SENIOR LEAD AUDITOR ENGINE & SCHEDULER PIPELINES ===", flush=True)
    client = httpx.Client(base_url="http://localhost:8000")

    # 1. Test Senior Lead Auditor Diagnosis with 5-Why RCA & FMEA Risk Score
    res_audit = client.post("/api/audit/diagnose", json={
        "product_name": "SeniorAuditor_Injectable_50mg",
        "batch_size": "100,000 Vials",
        "has_hbel_pde": False,
        "process_validation_age": 4,
        "target_region": "MFDS",
        "lang": "ko"
    })
    assert res_audit.status_code == 200
    data = res_audit.json()
    assert "fmea_matrix" in data
    assert "auditor_profile" in data
    assert "alcoa_data_integrity_index" in data
    
    print(f"SUCCESS [HTTP 200]: 50-Year Lead Auditor Audit Report Generated!\n"
          f"  Auditor Profile: {data['auditor_profile']}\n"
          f"  FMEA RPN Risk Score: {data['fmea_matrix']['rpn_score']} ({data['fmea_matrix']['risk_level']})\n"
          f"  ALCOA+ Data Integrity Index: {data['alcoa_data_integrity_index']}\n"
          f"  Gaps Found: {len(data['gaps'])} Gaps with 5-Why Root Cause Analysis (RCA)", flush=True)

    # 2. Test Scheduler Jobs Dry-Run
    from scripts.unresolved_query_analyzer import analyze_and_heal_unresolved_queries
    from scripts.full_structure_auditor import run_monthly_structural_audit

    insights = analyze_and_heal_unresolved_queries()
    assert insights["processed_count"] >= 0
    print("SUCCESS: Daily KST 12:00 Unresolved Query Self-Healing Pipeline Passed Clean!", flush=True)

    health_ok = run_monthly_structural_audit()
    assert health_ok is True
    print("SUCCESS: Monthly Full Structural Health Audit Passed Clean!", flush=True)

if __name__ == "__main__":
    test_50_year_lead_auditor_features()
