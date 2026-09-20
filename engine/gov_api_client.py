"""Official data adapters. Missing data is never replaced by invented records."""
from urllib.parse import quote
import httpx


class GlobalGovAPIClient:
    async def fetch_openfda_drug_label(self, drug_name):
        name = drug_name.replace('\\', '').replace('"', '')
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                res = await client.get('https://api.fda.gov/drug/label.json', params={'search': f'openfda.generic_name:"{name}"', 'limit': 1})
            if res.status_code == 404:
                return {'status': 'NOT_FOUND', 'records': [], 'message': 'No matching label record found. This does not determine approval status.'}
            res.raise_for_status()
            records = res.json().get('results', [])
            if not isinstance(records, list) or any(not isinstance(record, dict) for record in records):
                raise ValueError('Invalid label response')
            if not records:
                return {'status': 'NOT_FOUND', 'records': []}
            return {'status': 'SUCCESS', 'source_url': str(res.url), 'records': records,
                    'message': 'Label database result; not proof of regulatory approval.'}
        except (httpx.HTTPError, ValueError, AttributeError, TypeError):
            return {'status': 'UNAVAILABLE', 'records': [], 'message': 'openFDA could not be queried.'}

    async def fetch_pubchem_compound_data(self, compound_name):
        url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/'+quote(compound_name, safe='')+'/property/IUPACName,MolecularWeight,MolecularFormula/JSON'
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                res = await client.get(url)
            if res.status_code == 404:
                return {'status': 'NOT_FOUND', 'records': []}
            res.raise_for_status()
            records = res.json().get('PropertyTable', {}).get('Properties', [])
            if not isinstance(records, list) or any(not isinstance(record, dict) for record in records):
                raise ValueError('Invalid compound response')
            return {'status': 'SUCCESS' if records else 'NOT_FOUND', 'source_url': url, 'records': records,
                    'message': 'Chemical identity data; not a regulatory limit or approval.'}
        except (httpx.HTTPError, ValueError, AttributeError, TypeError):
            return {'status': 'UNAVAILABLE', 'records': [], 'message': 'PubChem could not be queried.'}


gov_api_client = GlobalGovAPIClient()
