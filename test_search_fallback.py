import sys
import httpx
import json

sys.path.insert(0, ".")

def test_search_fallback_engine():
    print("=== TESTING AI SEARCH ENGINE FALLBACK & RELIABILITY ===", flush=True)
    
    # Test POST /api/search
    res = httpx.post("http://localhost:8000/api/search", json={
        "query": "cleaning validation HBEL PDE limits",
        "target_region": "MFDS",
        "lang": "ko"
    }, timeout=10.0)
    
    assert res.status_code == 200, f"Search API failed with status {res.status_code}"
    data = res.json()
    assert data["status"] == "SUCCESS", "Search API response status is not SUCCESS"
    assert "llama-3.3-70b-versatile" not in data.get("summary", ""), "Raw error string leaked into summary"
    print(f"SUCCESS [HTTP 200]: Search API returned response using engine: '{data['engine']}'", flush=True)
    print(f"Summary Snippet: {data['summary'][:150]}...", flush=True)

    # Test GET /api/search
    get_res = httpx.get("http://localhost:8000/api/search?q=phenoxyethanol", timeout=10.0)
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["status"] == "SUCCESS"
    assert len(get_data.get("matched_ingredients", [])) >= 1
    print(f"SUCCESS [HTTP 200]: GET /api/search matched ingredient '{get_data['matched_ingredients'][0]['name']}'", flush=True)

    print("\nAI SEARCH ENGINE FALLBACK & ZERO-ERROR VERIFICATION PASSED 100% SUCCESS!", flush=True)

if __name__ == "__main__":
    test_search_fallback_engine()
