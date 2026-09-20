# GlobalRegAI reliability release

## Confirmed live failures

Inspected https://www.globalregai.info on 20 September 2026, with source at commit `90acc751f633e3586d972b3c30c2ceacac5f2bd9`.

- Chat stayed on its loading message. Browser console reported `Cannot set properties of null (setting 'innerText')` in `sendPrompt`. The Python HTML string produced a dollar-prefixed element ID, while JavaScript looked up the unprefixed ID.
- Selecting **Standards & QMS** produced an unencoded ampersand in the query string and opened Pharmaceuticals. The same URL construction affected Animal & Veterinary.
- Agency selection was not passed to the search API. The usage counter was hard-coded, and registration linked to the developer login rather than a user-registration service.
- Search fallback returned the same unsourced pharmaceutical assertions across queries and domains. Government adapters fabricated approval/manufacturer records or substituted phenoxyethanol properties for unrelated compounds.
- The GMP engine assigned a universal three-year validation rule, arbitrary scores, an ALCOA+ percentage and inferred root causes without documentary evidence.
- Translation silently cut paragraphs and characters, substituted Korean glossary phrases even for other target languages, and could report success when providers or parsers failed. File language fields did not match multipart form input.
- The served login form exposed a default password. A fixed session token appeared in public source. Login and logout modified one response but returned a different response, losing cookie changes. Vault endpoints had no authentication.

## Changes

The Vercel entry point remains `app.py`; existing public tool URLs are retained. Server-rendered templates and static JavaScript/CSS replace the large inline f-string page generator. The React/Vite and local Docker/Open WebUI projects in this repository are separate legacy/local applications and were not redeployed or refactored.

- **Research:** a curated official-source catalogue, bounded concurrent retrieval, same-host HTTPS redirects only, HTML/PDF extraction, optional Groq synthesis, exact-quotation checks, explicit missing coverage/upstream failure states. Supported quotations do not prove entailment, applicability, currency or completeness. AI output is always labelled a draft. Sources are fetched for each request; effective dates are not inferred from retrieval timestamps.
- **Review:** reported facts produce evidence-review tasks. No automated regulatory approval, compliance score, fabricated root cause or audit-ready status.
- **Export:** category-specific planning questions and source links. No unverifiable ingredient-limit or complete-checklist claims.
- **Translation:** configurable official DeepL API, explicit third-party consent, accurate language routing, full accepted text, visible errors and document limits. Replaces the undocumented Google GTX/MyMemory chain. Requires a new provider configuration; it is intentionally unavailable without one. Machine translation still requires human review.
- **Access:** PBKDF2 password hashes, signed expiring sessions, HttpOnly/SameSite cookies, password-rotation invalidation, protected vault/admin endpoints, no default credentials.
- **Interface:** encoded domain URLs, working jurisdiction and answer-language selectors, safe text rendering, timeout/error handling, duplicate-submit prevention, mobile layout, labelled forms and no fake usage or capability claims.
- **Operations:** `/api/health` reports configuration presence separately from connectivity. No user questions/documents are intentionally logged. A per-worker request guard limits bursts; it is not a distributed quota system.

## Run and test

```bash
python -m venv .venv
# Activate .venv for your operating system.
python -m pip install -r requirements.txt
python -m pytest -q
node --check static/workspace.js
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

For DOM interaction tests, install `jsdom@30.1.0` in a separate test directory using Node 24.15+ (or Node 22.22.2+), set `DOM_DEPENDENCY_ROOT` to that directory's `node_modules`, then run `python scripts/check_workspace_dom.py`. CI runs this check automatically.

Validation completed locally: **45 Python regression checks and 6 DOM integration checks passed**, JavaScript syntax check passed, and the patch passed Git whitespace checks. Live retrieval succeeded for the FDA MoCRA page, FDA process-validation PDF, FDA data-integrity PDF and UK medical-device guidance. AI/translation provider success and failure paths were tested with mocked providers; no live authenticated model or translation credential was available. The browser could not open the local preview, so responsive CSS has not received real-browser visual verification. GitHub CI and production deployment have not run for this patch.

`pytest.ini` selects the maintained deterministic tests under `tests/`. Top-level `test_*.py` files are historical manual/live scripts that assume fabricated legacy behaviour or local services. They are not evidence of current regulatory correctness.

## Hosting configuration

| Variable | Purpose | Missing-value behaviour |
|---|---|---|
| `GROQ_API_KEY` | Existing server-side answer provider | Official sources only; no AI conclusion |
| `GROQ_MODEL` | Optional model ID (default `llama-3.3-70b-versatile`) | Uses the default; unsupported models return sources only |
| `DEEPL_API_KEY` | Official translation API | Translation unavailable |
| `DEEPL_API_PLAN` | `free` (default) or `pro` endpoint | Uses free endpoint |
| `GLOBALREGAI_ADMIN_USER` | Administrator username | Administrator access disabled |
| `GLOBALREGAI_ADMIN_PASSWORD_HASH` | PBKDF2 SHA-256 hash | Administrator access disabled |
| `GLOBALREGAI_SESSION_SECRET` | Random signing secret of at least 32 characters | Administrator access disabled |

Generate administrator values on your own machine using `python scripts/configure_admin.py`. Add the output in the hosting provider's environment UI, never in source control. Existing published default credentials must not be reused. The changed application no longer accepts the legacy static token; historical source remains public.

Vercel should continue deploying the existing Python entry point using `vercel.json`. The existing GitHub status identifies the project as **global-reg-ai**. The connected Vercel team list exposed only **betterskin**; direct access to **global-reg-ai** returned Project not found. Do not create a replacement project or change DNS to work around that access boundary.

Publishing the branch was also blocked: GitHub returned HTTP 403 **Resource not accessible by integration** for branch creation and tree creation. The local changes were not pushed, no pull request was created, and the live site is unchanged. Restore the connector's repository write access and access to the existing Vercel project before resuming deployment.

## Release gates and limitations

1. Configure the required provider and administrator environment values on the correct project; confirm preview deployment uses the intended GitHub commit.
2. Check all eight page routes and `/api/health`, then test real source retrieval, one non-sensitive AI query and one authorised translation against live providers.
3. Add platform/shared rate limits before broad public use. Per-process guards do not provide account quotas or cost ceilings on serverless replicas.
4. Have a qualified reviewer assess a representative regulatory benchmark, including MoCRA, device QMSR, GMP validation, jurisdiction conflicts and unanswerable questions. Automated quotation checks cannot establish legal correctness.
5. Extend the source catalogue with validated jurisdiction/product coverage. Korea, Japan, China, chemicals and many product-specific requirements remain uncovered. No claim of full global coverage is made.
6. Confidential vault, tenant accounts and autonomous browser submissions remain **not connected**. Sample records are not a substitute for these integrations. Do not upload confidential documents to the translation workflow.
7. Document extraction is bounded, not a malware sandbox. Production uploads should also be constrained by hosting request limits and monitored resource budgets. PDF OCR and preservation of layout are not included.
8. Configure external uptime/error monitoring separately. A health endpoint and regression CI do not constitute continuous production monitoring.

## Rollback

Keep the last known deployment ID before release and use Vercel's rollback mechanism if the new release fails. Rolling back to the previous code also restores the identified correctness and credential problems; restricting public access is preferable until those are resolved.
