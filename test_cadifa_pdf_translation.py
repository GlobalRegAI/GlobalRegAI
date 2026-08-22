import sys
import os
import httpx
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def run_10_iteration_cadifa_pdf_verification():
    print("=======================================================================", flush=True)
    print("=== STARTING 10-ITERATION CADIFA PDF & DOCUMENT TRANSLATION VERIFICATION ===", flush=True)
    print("=======================================================================", flush=True)

    client = httpx.Client(base_url="http://localhost:8000", timeout=15.0)

    # CADIFA Sample PDF Text Content
    cadifa_pdf_sample_text = (
        "SUGESTÃO DE NOMES PARA OS ARQUIVOS DOS PETICIONAMENTOS RELACIONADOS A CADIFA\n"
        "RECOMMENDED FILE NAMES FOR CADIFA RELATED SUBMISSIONS\n"
        "Módulo 1 / Module 1:\n"
        "1.1 Índice / Table of Contents: 11-m1-toc.pdf\n"
        "1.2.2 Justificativa / Justification: 122-justification.pdf\n"
        "1.2.3 Formulário de Petição / Application Form: 123-form.pdf\n"
        "1.2.4 Cópia da Exigência Técnica / Response: 124-response.pdf\n"
        "1.3.1 Atas de Reunião em Parlatório / Meeting Minutes: 131-minutes-date.pdf\n"
        "Módulo 2 / Module 2:\n"
        "2.3.S Insumo Farmacêutico Ativo / Active Pharmaceutical Ingredient: 23s-qos-var.pdf\n"
        "Módulo 3 / Module 3:\n"
        "3.2.S.1 Informações Gerais / General Information: 32s11-nomenclature-var.pdf\n"
        "3.2.S.2.5 Validação de Processo / Process Validation: 32s25-process-validation-var.pdf\n"
        "3.2.S.4 Controle de Qualidade do IFA / Control of Drug Substance: 32s41-specification-var.pdf\n"
        "3.2.S.7 Estabilidade / Stability: 32s71-stability-summary-var.pdf"
    )

    files = {
        "file": ("Recommended File Names for CADIFA Related Submissions_MFDS_Translated.pdf", cadifa_pdf_sample_text.encode('utf-8'), "application/pdf")
    }

    for iteration in range(1, 11):
        print(f"\n--- [CADIFA PDF TEST ITERATION {iteration}/10] ---", flush=True)
        try:
            res = client.post("/api/certification/translate-file?source_lang=en&target_lang=ko", files=files)
            assert res.status_code == 200, f"HTTP status failed: {res.status_code}"
            
            data = res.json()
            assert data["status"] == "SUCCESS"
            translated = data["translated_content"]
            
            # Crucial Verifications: ZERO %PDF-1.7 binary garbage & Clean Korean
            assert "%PDF-1.7" not in translated, "ERROR: Raw PDF bytecode detected in translation output!"
            assert "stream" not in translated.lower() or "stream" in cadifa_pdf_sample_text.lower(), "ERROR: PDF stream bytecode detected!"
            assert "CADIFA" in translated
            assert "공정 밸리데이션" in translated or "모듈" in translated or "품질" in translated

            print(f"✅ ITERATION {iteration}/10 PASSED CLEAN!\n"
                  f"  Applied Terms: {data['applied_glossary_terms_count']}\n"
                  f"  Preview:\n{translated[:250]}...", flush=True)

        except Exception as e:
            print(f"❌ ITERATION {iteration}/10 FAILED: {e}", flush=True)
            raise e

    print("\n=======================================================================", flush=True)
    print("=== 10-ITERATION CADIFA PDF VERIFICATION: ALL 10/10 PASSED CLEAN! ===", flush=True)
    print("=======================================================================", flush=True)

if __name__ == "__main__":
    run_10_iteration_cadifa_pdf_verification()
