import httpx
import json

def test_certification_translation_endpoints():
    print("=== TESTING CERTIFICATION TRANSLATOR & FILE UPLOAD ENDPOINTS ===", flush=True)
    client = httpx.Client(base_url="http://localhost:8000")

    # 1. Test GET /certification/translate
    res_get = client.get("/certification/translate")
    assert res_get.status_code == 200, f"GET /certification/translate failed with status {res_get.status_code}"
    assert "Certification & Document Auto-Translator" in res_get.text
    print("SUCCESS [HTTP 200]: Route '/certification/translate' rendered certification_translator.html successfully!", flush=True)

    # 2. Test POST /api/certification/translate-file with document payload
    sample_sop_content = (
        "Standard Operating Procedure for Pharmaceutical Manufacturing:\n"
        "1. Process Validation must establish Critical Quality Attribute (CQA) and Critical Process Parameter (CPP).\n"
        "2. Cleaning Validation protocol must calculate Health-Based Exposure Limit (HBEL) and Permitted Daily Exposure (PDE).\n"
        "3. Corrective and Preventive Action (CAPA) task force must record all Out of Specification (OOS) events in Batch Production Record.\n"
        "4. Data Integrity and Audit Trail must adhere to Good Manufacturing Practice (GMP)."
    )

    files = {
        "file": ("SOP_Cleaning_Validation_Sample.txt", sample_sop_content.encode('utf-8'), "text/plain")
    }

    res_post = client.post("/api/certification/translate-file", files=files)
    assert res_post.status_code == 200, f"POST /api/certification/translate-file failed with status {res_post.status_code}"
    
    data = res_post.json()
    assert data["status"] == "SUCCESS"
    assert data["applied_glossary_terms_count"] > 0
    print(f"SUCCESS [HTTP 200]: File upload & auto-translate completed!\n"
          f"  Uploaded File: {data['file_name']}\n"
          f"  Applied MFDS Terms Count: {data['applied_glossary_terms_count']}\n"
          f"  Translated Preview:\n{data['translated_content'][:300]}...", flush=True)

if __name__ == "__main__":
    test_certification_translation_endpoints()
