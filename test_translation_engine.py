import sys
import httpx

def test_translation_and_multilingual():
    print("=== TESTING FREE MULTI-LANGUAGE DOCUMENT TRANSLATION ENGINE ===", flush=True)
    client = httpx.Client(base_url="http://localhost:8000")

    # 1. Test Translation Endpoint (POST /api/translate)
    sample_sop_text = "Cleaning validation must evaluate residual TOC and determine Health-Based Exposure Limits (HBEL/PDE)."
    res = client.post("/api/translate", json={"text": sample_sop_text, "target_lang": "ko"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    print(f"SUCCESS [HTTP 200]: Free Translation Engine ({data['engine']}):\n  Original: {data['original_text']}\n  Translated ({data['target_lang']}): {data['translated_text']}", flush=True)

    # 2. Test Multi-Language URL persistence across 5 languages
    languages = ["ko", "en", "ja", "zh", "de"]
    routes = ["/", "/gmp-core", "/export-intelligence", "/agent-portal", "/confidential-vault", "/developer-console"]
    
    for lang in languages:
        for route in routes:
            url = f"{route}?lang={lang}"
            r = client.get(url)
            assert r.status_code == 200, f"Failed URL {url} with status {r.status_code}"
    
    print(f"SUCCESS [HTTP 200]: Simulated 30 Multilingual Route Combinations (5 Languages x 6 Separated Pages) 100% OK!", flush=True)

if __name__ == "__main__":
    test_translation_and_multilingual()
