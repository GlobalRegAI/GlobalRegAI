import sys
import os
import httpx
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def run_10_iteration_zero_fault_cadifa_verification():
    print("=======================================================================", flush=True)
    print("=== STARTING 10-ITERATION ZERO-FAULT CADIFA TRANSLATION VERIFICATION ===", flush=True)
    print("=======================================================================", flush=True)

    client = httpx.Client(base_url="http://localhost:8000", timeout=15.0)

    # Actual Portuguese & English CADIFA List 02 (ANVISA) text
    cadifa_portuguese_sample = (
        "COIFA/GQMED/GGMED/DIRE2\n"
        "SUGESTÃO DE NOMES PARA OS ARQUIVOS DOS PETICIONAMENTOS RELACIONADOS A CADIFA\n"
        "RECOMMENDED FILE NAMES FOR CADIFA RELATED SUBMISSIONS\n"
        "Módulo 1 / Module 1:\n"
        "1.1 Índice / Table of Contents: 11-m1-toc.pdf\n"
        "1.2.2 Justificativa / Justification: 122-justification.pdf\n"
        "1.2.3 Formulário de Petição / Application Form: 123-form.pdf\n"
        "1.2.4 Cópia da Exigência Técnica / Response: 124-response.pdf\n"
        "1.2.5 Comprovante de quitação da TFVS / TFVS Payment Receipt: 125-tfvs.pdf\n"
        "1.3.1 Atas de Reunião em Parlatório / Meeting Minutes: 131-minutes-date.pdf\n"
        "Módulo 2 / Module 2:\n"
        "2.3.S Insumo Farmacêutico Ativo / Active Pharmaceutical Ingredient: 23s-qos-var.pdf\n"
        "Resumo Geral da Qualidade / Quality Overall Summary\n"
        "Módulo 3 / Module 3:\n"
        "3.2.S.1 Informações Gerais / General Information: 32s11-nomenclature-var.pdf\n"
        "3.2.S.2.5 Validação de Processo / Process Validation: 32s25-process-validation-var.pdf\n"
        "3.2.S.4 Controle de Qualidade do IFA / Control of Drug Substance: 32s41-specification-var.pdf\n"
        "3.2.S.7 Estabilidade / Stability: 32s71-stability-summary-var.pdf"
    )

    for iteration in range(1, 11):
        print(f"\n--- [ZERO-FAULT CADIFA VERIFICATION ITERATION {iteration}/10] ---", flush=True)

        try:
            # 1. Test POST /api/translate with Portuguese auto-detection (sl=auto)
            res_trans = client.post("/api/translate", json={
                "text": cadifa_portuguese_sample,
                "source_lang": "auto",
                "target_lang": "ko"
            })
            assert res_trans.status_code == 200, f"HTTP Status Error: {res_trans.status_code}"
            t_data = res_trans.json()
            translated = t_data["translated_text"]

            # Strict Verification Checks: Zero PDF Bytecode & Clean Korean CADIFA terms
            assert "<</Type/Catalog" not in translated, "ERROR: Bytecode leakage detected!"
            assert "&lt;" not in translated, "ERROR: HTML tag leakage detected!"
            assert "endobj" not in translated, "ERROR: endobj leakage detected!"
            assert "CADIFA" in translated
            assert "원료의약품" in translated or "품질" in translated or "모듈" in translated

            # 2. Test File Upload API /api/certification/translate-file
            files = {
                "file": ("Recommended File Names for CADIFA Related Submissions.pdf", cadifa_portuguese_sample.encode('utf-8'), "application/pdf")
            }
            res_file = client.post("/api/certification/translate-file?source_lang=auto&target_lang=ko", files=files)
            assert res_file.status_code == 200
            f_data = res_file.json()
            f_translated = f_data["translated_content"]

            assert "<</Type/Catalog" not in f_translated, "FILE ERROR: Bytecode leakage!"
            assert "&lt;" not in f_translated, "FILE ERROR: Tag leakage!"

            print(f"✅ ITERATION {iteration}/10 PASSED CLEAN!\n"
                  f"  Engine: {t_data['engine']}\n"
                  f"  Clean Translated Result Preview:\n{translated[:220]}...", flush=True)

        except Exception as e:
            print(f"❌ ITERATION {iteration}/10 FAILED: {e}", flush=True)
            raise e

    print("\n=======================================================================", flush=True)
    print("=== 10-ITERATION ZERO-FAULT CADIFA VERIFICATION: ALL 10/10 PASSED CLEAN! ===", flush=True)
    print("=======================================================================", flush=True)

if __name__ == "__main__":
    run_10_iteration_zero_fault_cadifa_verification()
