# GlobalRegAI 10 Virtual Client Accounts Profiles & Data Store

VIRTUAL_CLIENTS = {
    "CLIENT-001": {
        "client_id": "CLIENT-001",
        "company_name": "BioCell Pharm Korea",
        "industry": "Pharmaceuticals & Injectables",
        "target_region": "MFDS",
        "country_name": "Korea (MFDS)",
        "payload": {
            "product_name": "BioCell Sterile Injectable 50mg",
            "batch_size": "50,000 Vials",
            "has_hbel_pde": False,  # Missing HBEL/PDE -> CRITICAL
            "process_validation_age": 1,
            "hvac_status": "COMPLIANT",
            "ingredients": ["phenoxyethanol"],
            "target_region": "MFDS",
            "lang": "ko"
        }
    },
    "CLIENT-002": {
        "client_id": "CLIENT-002",
        "company_name": "Aesthetic Pro USA",
        "industry": "Functional Cosmetics",
        "target_region": "FDA",
        "country_name": "USA (FDA)",
        "payload": {
            "product_name": "AestheticPro Anti-Aging Serum",
            "batch_size": "100,000 Units",
            "has_hbel_pde": True,
            "process_validation_age": 4,  # Overdue 4 years -> MAJOR
            "hvac_status": "COMPLIANT",
            "ingredients": ["niacinamide", "adenosine"],
            "target_region": "FDA",
            "lang": "en"
        }
    },
    "CLIENT-003": {
        "client_id": "CLIENT-003",
        "company_name": "EuroSkin Derma GmbH",
        "industry": "Sensitive Skin Care",
        "target_region": "EMA",
        "country_name": "EU (EMA / CPNP)",
        "payload": {
            "product_name": "DermaCalm Sensitive Cream 50ml",
            "batch_size": "20,000 Tubes",
            "has_hbel_pde": True,
            "process_validation_age": 1,
            "hvac_status": "COMPLIANT",
            "ingredients": ["isobutyl_paraben", "phenoxyethanol"],  # Contains BANNED ingredient -> CRITICAL
            "target_region": "EMA",
            "lang": "de"
        }
    },
    "CLIENT-004": {
        "client_id": "CLIENT-004",
        "company_name": "SinoBio Health Shanghai",
        "industry": "Nutraceuticals & Functional Beauty",
        "target_region": "NMPA",
        "country_name": "China (NMPA)",
        "payload": {
            "product_name": "SinoBio Whitening Essence",
            "batch_size": "80,000 Bottles",
            "has_hbel_pde": True,
            "process_validation_age": 2,
            "hvac_status": "COMPLIANT",
            "ingredients": ["niacinamide", "arbutin"],
            "target_region": "NMPA",
            "lang": "zh"
        }
    },
    "CLIENT-005": {
        "client_id": "CLIENT-005",
        "company_name": "Nippon MedTech Tokyo",
        "industry": "Medical Devices (IVD)",
        "target_region": "PMDA",
        "country_name": "Japan (PMDA)",
        "payload": {
            "product_name": "Nippon IVD Diagnostic Reagent Kit",
            "batch_size": "10,000 Kits",
            "has_hbel_pde": True,
            "process_validation_age": 1,
            "hvac_status": "COMPLIANT",
            "ingredients": [],
            "target_region": "PMDA",
            "lang": "ja"
        }
    },
    "CLIENT-006": {
        "client_id": "CLIENT-006",
        "company_name": "Sydney Sanitizer Ltd",
        "industry": "Quasi-Drugs & Sanitizers",
        "target_region": "TGA",
        "country_name": "Australia (TGA)",
        "payload": {
            "product_name": "Sydney Cleanroom Surface Sanitizer 1L",
            "batch_size": "30,000 Liters",
            "has_hbel_pde": True,
            "process_validation_age": 1,
            "hvac_status": "OVERDUE",  # HEPA leak test overdue -> MINOR
            "ingredients": ["phenoxyethanol"],
            "target_region": "TGA",
            "lang": "en"
        }
    },
    "CLIENT-007": {
        "client_id": "CLIENT-007",
        "company_name": "Maple Leaf Pharma Inc",
        "industry": "Sterile Injectables",
        "target_region": "HC",
        "country_name": "Canada (Health Canada)",
        "payload": {
            "product_name": "Maple Injection Solution 100mg",
            "batch_size": "40,000 Vials",
            "has_hbel_pde": False,  # Missing HBEL -> CRITICAL
            "process_validation_age": 4,  # Overdue PV -> MAJOR (Combo = CRITICAL_RISK)
            "hvac_status": "COMPLIANT",
            "ingredients": ["phenoxyethanol"],
            "target_region": "HC",
            "lang": "en"
        }
    },
    "CLIENT-008": {
        "client_id": "CLIENT-008",
        "company_name": "Rio BioCare Brasil",
        "industry": "Skincare & Anti-Aging",
        "target_region": "ANVISA",
        "country_name": "Brazil (ANVISA)",
        "payload": {
            "product_name": "Rio Retinol Youth Cream 30g",
            "batch_size": "15,000 Jars",
            "has_hbel_pde": True,
            "process_validation_age": 1,
            "hvac_status": "COMPLIANT",
            "ingredients": ["retinol", "niacinamide"],
            "target_region": "ANVISA",
            "lang": "en"
        }
    },
    "CLIENT-009": {
        "client_id": "CLIENT-009",
        "company_name": "LionCity Med Singapore",
        "industry": "Medical Devices",
        "target_region": "HSA",
        "country_name": "Singapore (HSA)",
        "payload": {
            "product_name": "LionCity Surgical Catheter Kit",
            "batch_size": "5,000 Sets",
            "has_hbel_pde": True,
            "process_validation_age": 1,
            "hvac_status": "COMPLIANT",  # Fully compliant -> EXCELLENT 100/100
            "ingredients": [],
            "target_region": "HSA",
            "lang": "en"
        }
    },
    "CLIENT-010": {
        "client_id": "CLIENT-010",
        "company_name": "Gulf Health Riyadh",
        "industry": "Functional Cosmetics",
        "target_region": "GCC",
        "country_name": "Saudi Arabia / GCC (SFDA)",
        "payload": {
            "product_name": "Gulf Royal Whitening Cream",
            "batch_size": "25,000 Units",
            "has_hbel_pde": True,
            "process_validation_age": 1,
            "hvac_status": "COMPLIANT",
            "ingredients": ["phenoxyethanol", "arbutin"],
            "target_region": "GCC",
            "lang": "en"
        }
    }
}
