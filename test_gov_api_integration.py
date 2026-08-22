import sys
import os
import httpx

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def test_government_apis():
    print("=== TESTING OFFICIAL GLOBAL GOVERNMENT REGULATORY APIS ===", flush=True)
    client = httpx.Client(base_url="http://localhost:8000")

    # 1. Test openFDA API Endpoint (/api/gov/fda-label)
    res_fda = client.get("/api/gov/fda-label?drug_name=phenoxyethanol")
    assert res_fda.status_code == 200
    data_fda = res_fda.json()
    assert "source" in data_fda
    print(f"SUCCESS [HTTP 200]: US openFDA API ({data_fda['source']}):\n  Brand Name: {data_fda['brand_name']}\n  Manufacturer: {data_fda['manufacturer_name']}", flush=True)

    # 2. Test Korea MFDS API Endpoint (/api/gov/mfds-drug)
    res_mfds = client.get("/api/gov/mfds-drug?name=아세트아미노펜")
    assert res_mfds.status_code == 200
    data_mfds = res_mfds.json()
    assert "approval_status" in data_mfds
    print(f"SUCCESS [HTTP 200]: Korea MFDS Official API ({data_mfds['source']}):\n  Item Name: {data_mfds['item_name']}\n  Status: {data_mfds['approval_status']}", flush=True)

    # 3. Test NIH PubChem API Endpoint (/api/gov/pubchem-compound)
    res_pubchem = client.get("/api/gov/pubchem-compound?name=phenoxyethanol")
    assert res_pubchem.status_code == 200
    data_pubchem = res_pubchem.json()
    assert "molecular_weight" in data_pubchem
    print(f"SUCCESS [HTTP 200]: NIH PubChem API ({data_pubchem['source']}):\n  IUPAC Name: {data_pubchem['iupac_name']}\n  MW: {data_pubchem['molecular_weight']}", flush=True)

if __name__ == "__main__":
    test_government_apis()
