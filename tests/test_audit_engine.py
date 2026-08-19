import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.audit_engine import AuditEngine, GapSeverity, REGULATORY_STANDARDS, PRODUCT_CATEGORIES
from mcp_server.gmp_mcp_server import INGREDIENT_REGULATORY_DATABASE, search_ingredient_regulatory_limits, get_export_regulatory_checklist
from i18n import get_text, I18N_DICTIONARY

@pytest.fixture
def audit_engine():
    return AuditEngine()

def test_missing_cleaning_validation_hbel_pde_returns_critical(audit_engine):
    payload = {
        "product_name": "TestInjectable 10mg",
        "batch_size": "10,000 Vials",
        "cleaning_validation_report": {"has_hbel_pde": False},
        "process_validation_report": {"age_years": 1}
    }
    result = audit_engine.diagnose_gmp_gaps(payload, lang="ko")
    assert result["gap_count"] >= 1
    critical_gaps = [g for g in result["gaps"] if g["severity"] == GapSeverity.CRITICAL.value]
    assert len(critical_gaps) >= 1

def test_expired_process_validation_over_3_years_returns_major(audit_engine):
    payload = {
        "product_name": "TabletAlpha 50mg",
        "batch_size": "100,000 Tablets",
        "cleaning_validation_report": {"has_hbel_pde": True},
        "process_validation_report": {"age_years": 4}
    }
    result = audit_engine.diagnose_gmp_gaps(payload, lang="en")
    major_gaps = [g for g in result["gaps"] if g["severity"] == GapSeverity.MAJOR.value]
    assert len(major_gaps) >= 1

def test_banned_ingredient_detection_triggers_critical(audit_engine):
    """
    Scenario: Verify that detecting a banned ingredient (isobutyl_paraben) triggers a CRITICAL gap.
    """
    payload = {
        "product_name": "BannedCream 50g",
        "ingredients": ["isobutyl_paraben", "phenoxyethanol"],
        "cleaning_validation_report": {"has_hbel_pde": True},
        "process_validation_report": {"age_years": 1}
    }
    result = audit_engine.diagnose_gmp_gaps(payload, lang="ko")
    ing_gaps = [g for g in result["gaps"] if "Banned Ingredient" in g["title"]]
    assert len(ing_gaps) >= 1
    assert ing_gaps[0]["severity"] == GapSeverity.CRITICAL.value

def test_all_10_global_countries_and_6_categories(audit_engine):
    """
    Scenario: Verify 100% complete coverage across all 10 countries and 6 categories.
    """
    assert len(REGULATORY_STANDARDS) == 10
    assert len(PRODUCT_CATEGORIES) == 6

    for region_code in REGULATORY_STANDARDS:
        payload = {
            "product_name": f"GlobalCheck-{region_code}",
            "target_region": region_code,
            "ingredients": ["phenoxyethanol"],
            "cleaning_validation_report": {"has_hbel_pde": True},
            "process_validation_report": {"age_years": 1}
        }
        res = audit_engine.diagnose_gmp_gaps(payload, lang="ko")
        assert res["target_region"] == REGULATORY_STANDARDS[region_code]["name"]

def test_export_checklist_and_ingredient_mcp_tools():
    """
    Verify FastMCP export checklist and ingredient search tools.
    """
    chk = get_export_regulatory_checklist("PHARMA", "FDA")
    assert "FDA" in chk
    assert "1. Raw Material" in chk

    ing = search_ingredient_regulatory_limits("phenoxyethanol")
    assert "Phenoxyethanol" in ing
    assert "1.0%" in ing
