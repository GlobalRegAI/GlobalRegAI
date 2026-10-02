"""Render the actual FastAPI templates and exercise their JavaScript in a DOM harness."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient
from app import app

routes = ['/?domain=Standards%20%26%20QMS&lang=ko&region=FDA', '/',
          '/?domain=Animal%20%26%20Veterinary&lang=ja', '/gmp-core', '/export-intelligence']
with TestClient(app) as client, tempfile.TemporaryDirectory() as temporary:
    fixtures = {}
    for route in routes:
        response = client.get(route)
        response.raise_for_status()
        fixtures[route] = response.text
    destination = Path(temporary) / 'pages.json'
    destination.write_text(json.dumps(fixtures), encoding='utf-8')
    result = subprocess.run(['node', str(ROOT / 'tests/workspace_dom.cjs')], cwd=ROOT,
                            env={**os.environ, 'HTML_FIXTURE_PATH': str(destination)})
    raise SystemExit(result.returncode)
