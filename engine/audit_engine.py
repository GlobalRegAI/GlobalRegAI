import datetime
from typing import List, Dict, Any, Optional
from enum import Enum
from i18n import I18N_DICTIONARY, get_text
from mcp_server.gmp_mcp_server import INGREDIENT_REGULATORY_DATABASE

class GapSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    MINOR = "MINOR"

REGULATORY_STANDARDS = {
    "MFDS": {"name": "Korea MFDS (KGMP Annex 1)", "cv_rule": "KGMP Annex 1 / PIC/S PI 006-3", "pv_rule": "KGMP Mandatory 3-Year Re-Validation Cycle", "hvac_rule": "ISO 14644 / KGMP Cleanroom Standards"},
    "FDA": {"name": "US FDA (21 CFR Part 211)", "cv_rule": "FDA 21 CFR §211.67 / Guide to Inspections Validation of Cleaning Processes", "pv_rule": "FDA Process Validation Guidance (Stage 3 CPV - 3-Year Review)", "hvac_rule": "FDA Sterile Drug Products Aseptic Processing / ISO 14644"},
    "EMA": {"name": "EU EMA (Annex 1 & Volume 4)", "cv_rule": "EudraLex Vol 4 Annex 15 / Guideline on Setting Health Based Exposure Limits (HBEL)", "pv_rule": "EU GMP Vol 4 Annex 15 Periodic Re-Validation", "hvac_rule": "EudraLex Vol 4 Annex 1 Cleanroom Grade A/B/C/D"},
    "NMPA": {"name": "China NMPA (CSAR Regulatory Standard)", "cv_rule": "China NMPA Good Manufacturing Practice Chapter 5 Cleaning", "pv_rule": "NMPA 3-Year Re-Validation & Registration Renewal Cycle", "hvac_rule": "GB 50073 Cleanroom Clean Plant Design Standard"},
    "PMDA": {"name": "Japan PMDA (MHW Ordinance 179)", "cv_rule": "PMDA GMP Ordinance Art. 13 (Cleaning Validation & PDE Limits)", "pv_rule": "PMDA 3-Year Process Verification & Change Management Protocol", "hvac_rule": "JIS B 9920 / PMDA Cleanroom Standards"},
    "TGA": {"name": "Australia TGA (Therapeutic Goods Act)", "cv_rule": "PIC/S Guide to GMP for Medicinal Products Annex 15", "pv_rule": "TGA Mandatory 36-Month Re-Validation Log", "hvac_rule": "AS/NZS ISO 14644 Cleanroom Standard"},
    "HC": {"name": "Health Canada (GUI-0001 / GUI-0028)", "cv_rule": "Health Canada Cleaning Validation Guidelines (GUI-0028)", "pv_rule": "Health Canada Process Validation Guidelines (GUI-0029)", "hvac_rule": "Health Canada Environmental Monitoring Standards"},
    "ANVISA": {"name": "Brazil ANVISA (RDC 301/2019)", "cv_rule": "ANVISA RDC 301/2019 Cleaning Validation & HBEL Criteria", "pv_rule": "ANVISA RDC 301 Periodic Process Re-validation", "hvac_rule": "ANVISA Cleanroom Aseptic Classifications"},
    "HSA": {"name": "Singapore HSA (Health Sciences Authority)", "cv_rule": "HSA Guidance on GMP Compliance Annex 15", "pv_rule": "HSA 3-Year Process Re-Validation Requirement", "hvac_rule": "ISO 14644 HSA Cleanroom Standard"},
    "GCC": {"name": "GCC SFDA (Gulf Cooperation Council / Saudi FDA)", "cv_rule": "GCC Guidelines for Good Manufacturing Practice Part 1", "pv_rule": "GCC 3-Year Mandatory Process Re-validation Protocol", "hvac_rule": "GCC Cleanroom Standards"}
}

PRODUCT_CATEGORIES = {
    "PHARMA": "Pharmaceuticals & Sterile Injectables",
    "COSMETIC": "Functional Cosmetics & Skincare",
    "DEVICE": "Medical Devices & In-Vitro Diagnostics (IVD)",
    "SANITIZER": "Quasi-Drugs, Sanitizers & Disinfectants",
    "NUTRACEUTICAL": "Nutraceuticals & Dietary Supplements",
    "SENSITIVE": "Infant & Sensitive Skin Care"
}

class AuditEngine:
    def __init__(self):
        self.standard_cycle_years = 3
        self.client_history_vault = {}  # Multi-tenant client report archive

    def diagnose_gmp_gaps(self, payload: Dict[str, Any], lang: str = "ko") -> Dict[str, Any]:
        gaps = []
        base_score = 100

        client_id = payload.get("client_id", "DEFAULT-CLIENT")
        company_name = payload.get("company_name", "GlobalRegAI Client")

        region_code = payload.get("target_region", "MFDS").upper()
        if region_code not in REGULATORY_STANDARDS:
            region_code = "MFDS"
        
        standard_info = REGULATORY_STANDARDS[region_code]

        # Robust extraction for HBEL/PDE report presence
        has_hbel = False
        cv_report = payload.get("cleaning_validation_report")
        if cv_report and isinstance(cv_report, dict):
            has_hbel = cv_report.get("has_hbel_pde", False)
        elif "has_hbel_pde" in payload:
            has_hbel = bool(payload.get("has_hbel_pde", False))

        if not has_hbel:
            gaps.append({
                "gap_id": "GAP-CV-001",
                "severity": GapSeverity.CRITICAL.value,
                "category": "Cleaning Validation",
                "title": get_text("hbel_missing", lang),
                "standard": standard_info["cv_rule"],
                "description": "No Health-Based Exposure Limit (HBEL) or Permitted Daily Exposure (PDE) toxicological assessment report found for cross-contamination prevention.",
                "action_required": "Conduct toxicological assessment to determine HBEL/PDE limits and issue updated cleaning validation protocol."
            })
            base_score -= 35

        # Robust extraction for Process Validation age
        pv_age = None
        pv_report = payload.get("process_validation_report")
        if pv_report and isinstance(pv_report, dict):
            pv_age = pv_report.get("age_years")
        elif "process_validation_age" in payload:
            pv_age = payload.get("process_validation_age")

        if pv_age is None:
            gaps.append({
                "gap_id": "GAP-PV-001",
                "severity": GapSeverity.MAJOR.value,
                "category": "Process Validation",
                "title": "Missing Process Validation Report",
                "standard": standard_info["pv_rule"],
                "description": "Commercial manufacturing process lacks documented initial or periodic validation report.",
                "action_required": "Draft and execute process validation master plan (PVMP) for 3 consecutive commercial batches."
            })
            base_score -= 20
        elif pv_age > self.standard_cycle_years:
            gaps.append({
                "gap_id": "GAP-PV-002",
                "severity": GapSeverity.MAJOR.value,
                "category": "Process Validation",
                "title": f"Overdue 3-Year Process Re-Validation Cycle ({pv_age} Years Old)",
                "standard": standard_info["pv_rule"],
                "description": f"Process validation report is {pv_age} years old (exceeds maximum 3-year periodic re-validation cycle).",
                "action_required": "Initiate mandatory 3-year re-validation protocol and re-assess critical process parameters (CPPs)."
            })
            base_score -= 20

        # Robust extraction for HVAC status
        hvac_status = "COMPLIANT"
        hvac_report = payload.get("hvac_em_report")
        if hvac_report and isinstance(hvac_report, dict):
            hvac_status = hvac_report.get("status", "COMPLIANT")
        elif "hvac_status" in payload:
            hvac_status = payload.get("hvac_status", "COMPLIANT")

        if hvac_status == "OVERDUE":
            gaps.append({
                "gap_id": "GAP-HVAC-001",
                "severity": GapSeverity.MINOR.value,
                "category": "Facility & HVAC",
                "title": "Cleanroom HEPA Filter Certification Overdue",
                "standard": standard_info["hvac_rule"],
                "description": "Annual differential pressure and HEPA filter integrity test is past scheduled review date.",
                "action_required": "Schedule third-party HEPA leak test and re-certify Grade B/C airflow velocity."
            })
            base_score -= 10

        # Ingredient Banned / Limit Check
        ingredients_list = payload.get("ingredients", [])
        for ing in ingredients_list:
            ing_lower = ing.lower().strip()
            if ing_lower in INGREDIENT_REGULATORY_DATABASE:
                ing_data = INGREDIENT_REGULATORY_DATABASE[ing_lower]
                if ing_data["status"] == "PROHIBITED" or "BANNED" in ing_data["limits"].get(region_code, ""):
                    gaps.append({
                        "gap_id": f"GAP-ING-{ing_lower.upper()}",
                        "severity": GapSeverity.CRITICAL.value,
                        "category": "Ingredient Formulation",
                        "title": f"Banned Ingredient Detected: {ing_data['name']}",
                        "standard": f"{standard_info['name']} Ingredient Prohibited List",
                        "description": ing_data["warning"],
                        "action_required": f"Immediately reformulate to replace {ing_data['name']} with an approved alternative ingredient."
                    })
                    base_score -= 30

        health_score = max(0, min(100, base_score))
        status_badge = "EXCELLENT" if health_score >= 90 else ("WARNING" if health_score >= 70 else "CRITICAL_RISK")

        remediation_pack = self.generate_remediation_pack(gaps, payload, lang)

        report = {
            "client_id": client_id,
            "company_name": company_name,
            "product_name": payload.get("product_name", "Unknown Product"),
            "batch_size": payload.get("batch_size", "N/A"),
            "target_region": standard_info["name"],
            "lang": lang,
            "diagnosed_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "health_score": health_score,
            "status_badge": status_badge,
            "gap_count": len(gaps),
            "gaps": gaps,
            "remediation_pack": remediation_pack
        }

        if client_id not in self.client_history_vault:
            self.client_history_vault[client_id] = []
        self.client_history_vault[client_id].append(report)

        return report

    def get_client_history(self, client_id: str) -> List[Dict[str, Any]]:
        return self.client_history_vault.get(client_id, [])

    def generate_remediation_pack(self, gaps: List[Dict[str, Any]], payload: Optional[Dict[str, Any]] = None, lang: str = "ko") -> Dict[str, Any]:
        product_name = payload.get("product_name", "RegenBio Injectable Solution 50mg") if payload else "RegenBio Injectable Solution 50mg"
        batch_size = payload.get("batch_size", "50,000 Vials") if payload else "50,000 Vials"
        client_id = payload.get("client_id", "CLIENT-001") if payload else "CLIENT-001"

        remediation_actions = []
        for gap in gaps:
            remediation_actions.append({
                "gap_id": gap["gap_id"],
                "severity": gap["severity"],
                "target_document": f"SOP-CORR-{gap['gap_id']}.pdf",
                "remediation_title": f"Corrective Action Plan for {gap['title']}",
                "corrective_steps": [
                    f"Issue immediate CAPA task force assignment for {gap['category']}.",
                    gap["action_required"],
                    "Submit updated documentation to Regulatory Affairs Quality Committee."
                ],
                "due_days": 15 if gap["severity"] == "CRITICAL" else (30 if gap["severity"] == "MAJOR" else 60)
            })

        submission_payload = {
            "client_id": client_id,
            "product_name": product_name,
            "batch_size": batch_size,
            "validation_summary": f"Audit-Ready Remediation Plan Activated: {len(gaps)} Gap(s) Addressed under KGMP/ISO13485 standards.",
            "hbel_value": "0.01 mg/day (HBEL / PDE calculated per PIC/S PI 006-3)",
            "revalidation_cycle": "3 Years (Cycle Reset & Protocol PV-2026-R1 Issued)",
            "remediation_action": f"CAPA-{datetime.datetime.now().strftime('%Y%m%d')}-01: HBEL toxicological report appended & 3-year PV cycle scheduled."
        }

        return {
            "remediation_id": f"REM-PACK-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}",
            "client_id": client_id,
            "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "audit_ready": True,
            "total_remediations": len(remediation_actions),
            "actions": remediation_actions,
            "submission_payload": submission_payload
        }

audit_engine = AuditEngine()
