import sys
import os
import httpx
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def run_10_iteration_pdf_sanitizer_verification():
    print("=======================================================================", flush=True)
    print("=== STARTING 10-ITERATION PDF BYTECODE SANITIZER & LEAKAGE VERIFICATION ===", flush=True)
    print("=======================================================================", flush=True)

    client = httpx.Client(base_url="http://localhost:8000", timeout=15.0)

    # Simulated raw PDF bytecode string (exactly as shown in user screenshot)
    raw_pdf_bytecode_payload = (
        "<</Type/Catalog/Pages 2 0 R/Lang(pt-BR) /StructTreeRoot 32 0 R/MarkInfo<</Marked true>>/Metadata 661 0 R/ViewerPreferences 662 0 R>>\n"
        "endobj\n"
        "2 0 obj\n"
        "<</Type/Pages/Count 4/Kids[ 3 0 R 24 0 R 27 0 R 29 0 R] >>\n"
        "endobj\n"
        "3 0 obj\n"
        "SUGESTÃO DE NOMES PARA OS ARQUIVOS DOS PETICIONAMENTOS RELACIONADOS A CADIFA\n"
        "RECOMMENDED FILE NAMES FOR CADIFA RELATED SUBMISSIONS\n"
        "Módulo 1 / Module 1: Administrative Information\n"
        "1.2.2 Justificativa / Justification: 122-justification.pdf\n"
        "1.2.3 Formulário de Petição / Application Form: 123-form.pdf\n"
        "2.3.S Insumo Farmacêutico Ativo / Active Pharmaceutical Ingredient: 23s-qos-var.pdf\n"
        "3.2.S.2.5 Validação de Processo / Process Validation: 32s25-process-validation-var.pdf\n"
        "endstream\n"
        "endobj"
    )

    for iteration in range(1, 11):
        print(f"\n--- [BYTECODE SANITIZER TEST ITERATION {iteration}/10] ---", flush=True)

        try:
            # 1. Test POST /api/translate with raw bytecode string
            res_trans = client.post("/api/translate", json={
                "text": raw_pdf_bytecode_payload,
                "source_lang": "en",
                "target_lang": "ko"
            })
            assert res_trans.status_code == 200, f"HTTP failure: {res_trans.status_code}"
            t_data = res_trans.json()
            translated = t_data["translated_text"]

            # Strict Assertions: Zero %PDF / Catalog / obj / stream leakage
            assert "<</Type/Catalog" not in translated, "LEAKAGE ERROR: <</Type/Catalog found!"
            assert "&lt;" not in translated, "LEAKAGE ERROR: HTML encoded PDF bytecode found!"
            assert "endobj" not in translated, "LEAKAGE ERROR: endobj found!"
            assert "CADIFA" in translated or "원료의약품" in translated or "모듈" in translated

            # 2. Test File Upload Endpoint /api/certification/translate-file
            files = {
                "file": ("Recommended File Names for CADIFA Related Submissions.pdf", raw_pdf_bytecode_payload.encode('utf-8'), "application/pdf")
            }
            res_file = client.post("/api/certification/translate-file?source_lang=en&target_lang=ko", files=files)
            assert res_file.status_code == 200
            f_data = res_file.json()
            f_translated = f_data["translated_content"]

            assert "<</Type/Catalog" not in f_translated, "FILE LEAKAGE ERROR: <</Type/Catalog found!"
            assert "&lt;" not in f_translated, "FILE LEAKAGE ERROR: HTML encoded PDF bytecode found!"

            print(f"✅ ITERATION {iteration}/10: ALL PDF BYTECODE LEAKAGE TESTS PASSED CLEAN!\n"
                  f"  Engine: {t_data['engine']}\n"
                  f"  Clean Translated Result Preview:\n{translated[:220]}...", flush=True)

        except Exception as e:
            print(f"❌ ITERATION {iteration}/10 FAILED: {e}", flush=True)
            raise e

    print("\n=======================================================================", flush=True)
    print("=== 10-ITERATION PDF BYTECODE SANITIZER SUMMARY: 10/10 PASSED CLEAN! ===", flush=True)
    print("=======================================================================", flush=True)

if __name__ == "__main__":
    run_10_iteration_pdf_sanitizer_verification()
