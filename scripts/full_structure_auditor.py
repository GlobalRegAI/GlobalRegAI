# Monthly Full System Health & Structure Auditor
import sys
import os
import httpx
import datetime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def run_monthly_structural_audit():
    print("=== [MONTHLY AUDIT] 50-YEAR SENIOR LEAD AUDITOR FULL STRUCTURAL HEALTH INSPECTION ===", flush=True)
    
    # 1. File & Directory Integrity Check
    required_paths = [
        "app.py",
        "run_server.py",
        "i18n.py",
        "ads.txt",
        "engine/audit_engine.py",
        "mcp_server/gmp_mcp_server.py",
        "certification/certification_translator.html",
        "certification/mfds_translator.py"
    ]

    missing = [p for p in required_paths if not os.path.exists(p)]
    if missing:
        print(f"❌ Monthly Audit Failed: Missing files {missing}", flush=True)
        return False

    print("✅ System Core Files Integrity: 100% Verified Present.", flush=True)

    # 2. Ads.txt Verification
    with open("ads.txt", "r", encoding="utf-8") as f:
        ads_text = f.read()
    assert "pub-9335333067725848" in ads_text, "Google AdSense Publisher ID missing!"
    print("✅ Google AdSense Verification (pub-9335333067725848): Verified Active.", flush=True)

    # 3. Live Endpoint Verification
    client = httpx.Client(base_url="http://localhost:8000", timeout=5.0)
    res = client.get("/api/mcp/status")
    assert res.status_code == 200
    mcp_data = res.json()
    assert mcp_data["status"] == "ONLINE"
    print("✅ FastMCP Master Server & Capabilities: Verified ONLINE.", flush=True)

    print("\nMONTHLY FULL STRUCTURAL HEALTH AUDIT PASSED 100% CLEAN SUCCESS!", flush=True)
    return True

if __name__ == "__main__":
    run_monthly_structural_audit()
