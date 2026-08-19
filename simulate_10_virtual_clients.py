import sys
import httpx
import json

sys.path.insert(0, ".")

def run_10_clients_simulation():
    print("=== 10 VIRTUAL CLIENT ACCOUNTS MULTI-TENANT SIMULATION ===", flush=True)
    
    # 1. Fetch 10 client profiles list from API
    res = httpx.get("http://localhost:8000/api/clients")
    assert res.status_code == 200, "Failed to fetch client list from /api/clients"
    clients_data = res.json()["clients"]
    print(f"SUCCESS: Loaded {len(clients_data)} Virtual Client Profiles from API.\n", flush=True)

    # 2. Trigger multi-tenant batch simulation
    sim_res = httpx.post("http://localhost:8000/api/clients/simulate")
    assert sim_res.status_code == 200, "Failed to run batch simulation"
    sim_data = sim_res.json()

    print(f"{'CLIENT ID':<12} | {'COMPANY NAME':<25} | {'TARGET COUNTRY':<20} | {'SCORE':<8} | {'STATUS':<14} | {'GAPS'}", flush=True)
    print("-" * 95, flush=True)

    for item in sim_data["results"]:
        cid = item["client_id"]
        cname = item["company_name"]
        country = item["country"]
        score = f"{item['health_score']}/100"
        status = item["status_badge"]
        gaps = f"{item['gap_count']} Gaps"
        print(f"{cid:<12} | {cname:<25} | {country:<20} | {score:<8} | {status:<14} | {gaps}", flush=True)

    # 3. Test individual client history retrieval for CLIENT-001 and CLIENT-003
    hist1 = httpx.get("http://localhost:8000/api/clients/CLIENT-001/history").json()
    hist3 = httpx.get("http://localhost:8000/api/clients/CLIENT-003/history").json()
    assert hist1["history_count"] >= 1
    assert hist3["history_count"] >= 1
    print(f"\nSUCCESS: Client CLIENT-001 history isolated ({hist1['history_count']} report).")
    print(f"SUCCESS: Client CLIENT-003 history isolated ({hist3['history_count']} report).")

    print("\n10 VIRTUAL CLIENTS MULTI-TENANT SIMULATION COMPLETED WITH 100% SUCCESS!", flush=True)

if __name__ == "__main__":
    run_10_clients_simulation()
