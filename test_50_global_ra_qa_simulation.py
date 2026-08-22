import sys
import os
import json
import httpx

# Forced UTF-8 Encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

GLOBAL_RA_QA_PERSONAS = [
    # 🇰🇷 Korea (MFDS) 10 Personas
    {"id": 1, "region": "MFDS", "country": "Korea", "role": "KGMP Lead Auditor", "query": "식약처 KGMP 3년 주기 공정 재밸리데이션 요구사항 및 시정조치 CAPA 지침"},
    {"id": 2, "region": "MFDS", "country": "Korea", "role": "HBEL/PDE Toxicologist", "query": "세척 밸리데이션 잔류허용기준 HBEL/PDE 독성평가 보고서 허가심사 필수항목"},
    {"id": 3, "region": "MFDS", "country": "Korea", "role": "PV Re-validation Specialist", "query": "주사제 제형 4년 경과 공정 밸리데이션 재검증 및 CPP 공정변수 변경관리"},
    {"id": 4, "region": "MFDS", "country": "Korea", "role": "NDA CTD Module 3 Reviewer", "query": "의약품 품목허가신청 NDA CTD Module 3 품질자료 작성 가이드라인"},
    {"id": 5, "region": "MFDS", "country": "Korea", "role": "Biologicals & Vaccines Auditor", "query": "바이오의약품 백신 제조소 사전 GMP 평가 및 원자재 COA 규격서 검토"},
    {"id": 6, "region": "MFDS", "country": "Korea", "role": "Quasi-Drugs (의약외품) Lead", "query": "의약외품 보건용 마스크 손소독제 GMP 자율도입 적합판정서 발급 절차"},
    {"id": 7, "region": "MFDS", "country": "Korea", "role": "Medical Device GSPR Assessor", "query": "의료기기 품목허가 일반 안전 및 성능 요구사항 GSPR 기술문서 심사"},
    {"id": 8, "region": "MFDS", "country": "Korea", "role": "Health Functional Food Assessor", "query": "건강기능식품 구강붕해필름 ODF 제형 기능성 표시광고 실증자료 검토"},
    {"id": 9, "region": "MFDS", "country": "Korea", "role": "Imported Drug Pre-GMP Auditor", "query": "수입의약품 해외제조소 현장감사 및 수입품목 사전 GMP 적합판정서 제출"},
    {"id": 10, "region": "MFDS", "country": "Korea", "role": "Data Integrity Inspector", "query": "의약품 제조소 데이터 완전성 ALCOA+ 평가 및 감사추적 Audit Trail 관리"},

    # 🇺🇸 USA (US FDA) 10 Personas
    {"id": 11, "region": "FDA", "country": "USA", "role": "21 CFR Part 211 cGMP Lead", "query": "US FDA 21 CFR Part 211 commercial manufacturing batch production record compliance"},
    {"id": 12, "region": "FDA", "country": "USA", "role": "NDA/ANDA Module 3 Reviewer", "query": "US FDA NDA ANDA CTD Module 3 drug substance and drug product stability data"},
    {"id": 13, "region": "FDA", "country": "USA", "role": "Cleaning Validation MAC Specialist", "query": "FDA cleaning validation Maximum Allowable Carryover MAC and toxicological PDE limits"},
    {"id": 14, "region": "FDA", "country": "USA", "role": "3-Batch PV Process Engineer", "query": "FDA 3-consecutive commercial batch process validation PV protocol and CQA verification"},
    {"id": 15, "region": "FDA", "country": "USA", "role": "Data Integrity Investigator", "query": "FDA Warning Letter data integrity ALCOA+ Audit Trail electronic records Part 11"},
    {"id": 16, "region": "FDA", "country": "USA", "role": "OOS/OOT CAPA Specialist", "query": "FDA Out of Specification OOS investigation protocol and corrective action plan CAPA"},
    {"id": 17, "region": "FDA", "country": "USA", "role": "Medical Device 510(k) Reviewer", "query": "US FDA Medical Device 510k premarket notification substantial equivalence"},
    {"id": 18, "region": "FDA", "country": "USA", "role": "QSR Part 820 Quality Auditor", "query": "FDA Quality System Regulation QSR 21 CFR Part 820 design controls risk management"},
    {"id": 19, "region": "FDA", "country": "USA", "role": "Combination Products Lead", "query": "FDA Combination Product Primary Mode of Action PMOA drug constituent review"},
    {"id": 20, "region": "FDA", "country": "USA", "role": "Dietary Supplement Part 111 Lead", "query": "FDA 21 CFR Part 111 dietary supplement cGMP identity testing raw material specification"},

    # 🇪🇺 Europe (EU EMA / PIC/S) 10 Personas
    {"id": 21, "region": "EMA", "country": "EU", "role": "EudraLex Vol 4 Annex 15 Lead", "query": "EU EMA EudraLex Volume 4 Annex 15 qualification and validation 3-year re-validation"},
    {"id": 22, "region": "EMA", "country": "EU", "role": "Annex 1 Sterile Mfg. Inspector", "query": "EU EMA Annex 1 manufacture of sterile medicinal products Contamination Control Strategy CCS"},
    {"id": 23, "region": "EMA", "country": "EU", "role": "Annex 11 Computerized Systems", "query": "EU EMA Annex 11 computerized systems validation electronic signatures data security"},
    {"id": 24, "region": "EMA", "country": "EU", "role": "QP Qualified Person Release", "query": "EU Qualified Person QP batch certification batch release requirements under Directive 2001/83/EC"},
    {"id": 25, "region": "EMA", "country": "EU", "role": "CPNP Cosmetic Portal Lead", "query": "EU Cosmetic Product Notification Portal CPNP Cosmetic Product Safety Report CPSR Annex III"},
    {"id": 26, "region": "EMA", "country": "EU", "role": "ISO 13485 Medical Device QMS", "query": "EU MDR 2017/745 ISO 13485 Quality Management System Technical Documentation GSPR"},
    {"id": 27, "region": "EMA", "country": "EU", "role": "REACH SVHC Chemical Auditor", "query": "EU REACH Registration SVHC Substances of Very High Concern chemical safety assessment"},
    {"id": 28, "region": "EMA", "country": "EU", "role": "ISO 22000 Food Safety Auditor", "query": "ISO 22000 HACCP food safety management system prerequisite programs critical control points"},
    {"id": 29, "region": "EMA", "country": "EU", "role": "ATMP Advanced Therapy Lead", "query": "EU EMA Advanced Therapy Medicinal Products ATMP Regulation 1394/2007 GMP requirements"},
    {"id": 30, "region": "EMA", "country": "EU", "role": "Clinical CTR 536/2014 Lead", "query": "EU Clinical Trials Regulation CTR 536/2014 CTIS portal IMPD safety reporting EU-CTIS"},

    # 🇯🇵 Japan (PMDA / MHLW) 10 Personas
    {"id": 31, "region": "PMDA", "country": "Japan", "role": "PMDA Ordinance 179 J-GMP Lead", "query": "Japan PMDA Ordinance 179 J-GMP manufacturing control and quality control standards"},
    {"id": 32, "region": "PMDA", "country": "Japan", "role": "Foreign Manufacturer FMA Lead", "query": "Japan PMDA Foreign Manufacturer Accreditation FMA application procedures"},
    {"id": 33, "region": "PMDA", "country": "Japan", "role": "J-CTD Module 3 Reviewer", "query": "Japan PMDA J-CTD Module 3 quality documentation stability test ICH Q1A guidelines"},
    {"id": 34, "region": "PMDA", "country": "Japan", "role": "Drug Master File (MF) Specialist", "query": "Japan PMDA Drug Master File MF registration API active pharmaceutical ingredient"},
    {"id": 35, "region": "PMDA", "country": "Japan", "role": "Quasi-Drugs (医薬部外品) Lead", "query": "Japan MHLW Quasi-Drugs 医薬部外品 marketing approval active ingredient specifications"},
    {"id": 36, "region": "PMDA", "country": "Japan", "role": "Cosmetic Positive List Assessor", "query": "Japan Cosmetic Standards MHLW Positive List ingredient limits phenoxyethanol"},
    {"id": 37, "region": "PMDA", "country": "Japan", "role": "PMD Act Medical Device Reviewer", "query": "Japan PMD Act Medical Device classification Class I-IV Certification STED documentation"},
    {"id": 38, "region": "PMDA", "country": "Japan", "role": "Sterilization Validation Lead", "query": "Japan PMDA Terminal Sterilization Validation ISO 11137 SAL 10-6 microbial control"},
    {"id": 39, "region": "PMDA", "country": "Japan", "role": "GVP Vigilance Specialist", "query": "Japan MHLW GVP Good Vigilance Practice post-market safety management periodic safety reports"},
    {"id": 40, "region": "PMDA", "country": "Japan", "role": "GCTP Regenerative Med. Lead", "query": "Japan PMDA GCTP Regenerative Medicine and Gene Therapy products manufacturing standards"},

    # 🇨🇳 China (NMPA) 10 Personas
    {"id": 41, "region": "NMPA", "country": "China", "role": "CSAR Cosmetic Inspector", "query": "China NMPA CSAR Cosmetic Registration and Notification Safety Assessment Report NMPA portal"},
    {"id": 42, "region": "NMPA", "country": "China", "role": "China GMP Annex Auditor", "query": "China NMPA Good Manufacturing Practice GMP Annex 1-5 sterile products validation"},
    {"id": 43, "region": "NMPA", "country": "China", "role": "NMPA NDA/ANDA Registration Lead", "query": "China NMPA Drug Registration Regulation NDA ANDA dossier evaluation CDE review"},
    {"id": 44, "region": "NMPA", "country": "China", "role": "Imported Drug License IDL Lead", "query": "China NMPA Imported Drug License IDL approval foreign manufacturing inspection"},
    {"id": 45, "region": "NMPA", "country": "China", "role": "DMF Master File Reviewer", "query": "China NMPA Binding Review API Excipient Packaging Material DMF registration platform"},
    {"id": 46, "region": "NMPA", "country": "China", "role": "Medical Device Order 739 Reviewer", "query": "China NMPA Regulations on Supervision and Administration of Medical Devices Order 739"},
    {"id": 47, "region": "NMPA", "country": "China", "role": "Special Use Cosmetics Specialist", "query": "China NMPA Special Use Cosmetics whitening sunscreen registration Human Safety Test"},
    {"id": 48, "region": "NMPA", "country": "China", "role": "Formula Safety Assessor", "query": "China NMPA Cosmetic Ingredient Safety Information Code submissions phenoxyethanol limit"},
    {"id": 49, "region": "NMPA", "country": "China", "role": "ChP 2025 Pharmacopoeia Lead", "query": "Chinese Pharmacopoeia ChP 2025 edition analytical method validation general chapters"},
    {"id": 50, "region": "NMPA", "country": "China", "role": "Pediatric Drug RA Lead", "query": "China NMPA Priority Review and Approval for Pediatric Medicinal Products formulation review"}
]

def run_50_global_ra_qa_simulation():
    print("=======================================================================", flush=True)
    print("=== STARTING 50 GLOBAL RA/QA EXPERT PERSONA SIMULATION (50 SCENARIOS) ===", flush=True)
    print("=======================================================================", flush=True)

    client = httpx.Client(base_url="http://localhost:8000", follow_redirects=True, timeout=12.0)
    passed_count = 0
    failed_count = 0

    for persona in GLOBAL_RA_QA_PERSONAS:
        pid = persona["id"]
        role = persona["role"]
        country = persona["country"]
        region = persona["region"]
        query = persona["query"]

        print(f"\n[Persona #{pid:02d} | {country} ({region}) - {role}] Testing Query...", flush=True)

        try:
            # 1. Search Query API (/api/search)
            res_search = client.post("/api/search", json={
                "query": query,
                "target_region": region,
                "domain": "Pharmaceuticals",
                "lang": "ko" if region == "MFDS" else "en"
            })
            assert res_search.status_code == 200, f"Search failed with status {res_search.status_code}"
            s_data = res_search.json()
            assert s_data["status"] == "SUCCESS"

            # 2. Audit Diagnosis API (/api/audit/diagnose)
            res_audit = client.post("/api/audit/diagnose", json={
                "product_name": f"Product_{pid}_{country}",
                "batch_size": "50,000 Units",
                "has_hbel_pde": (pid % 2 == 0),
                "process_validation_age": 4 if (pid % 3 == 0) else 1,
                "target_region": region,
                "lang": "ko" if region == "MFDS" else "en"
            })
            assert res_audit.status_code == 200
            a_data = res_audit.json()
            assert "health_score" in a_data

            # 3. Export Checklist API (/api/export/checklist)
            res_chk = client.get(f"/api/export/checklist?category=PHARMA&country={region}")
            assert res_chk.status_code == 200

            # 4. Translation Engine API (/api/translate)
            res_trans = client.post("/api/translate", json={
                "text": f"Persona {pid} ({role}): Cleaning validation protocol requires HBEL toxicological evaluation for {country}.",
                "target_lang": "ko"
            })
            assert res_trans.status_code == 200
            t_data = res_trans.json()
            assert t_data["status"] == "SUCCESS"

            print(f"✅ Persona #{pid:02d} [{country} - {role}]: ALL 4 RA/QA APIS PASSED CLEAN! Score={a_data['health_score']}, Engine={s_data['engine']}", flush=True)
            passed_count += 1

        except Exception as e:
            print(f"❌ Persona #{pid:02d} [{country} - {role}] FAILED: {e}", flush=True)
            failed_count += 1

    print("\n=======================================================================", flush=True)
    print(f"=== 50 GLOBAL RA/QA PERSONAS SIMULATION SUMMARY: {passed_count}/50 PASSED PERFECTLY ===", flush=True)
    print("=======================================================================", flush=True)

    assert failed_count == 0, f"Simulation failed with {failed_count} errors."

if __name__ == "__main__":
    run_50_global_ra_qa_simulation()
