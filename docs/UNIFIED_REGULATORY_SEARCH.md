# Unified regulatory search — release 16

## Live implementation

The Python FastAPI application is the production service (the Vercel config routes to app.py). The older React entry is not the production homepage.

The homepage contains a single composer, a small language selector and examples. Questions are classified by topic and market. Missing categories, ambiguous origin/destination markets and export product details are requested progressively. Up to three markets are retrieved concurrently and displayed separately. Changing conditions preserves the original question; New question clears context. Conversation content stays in browser memory and is not saved to a shared database.

`POST /api/conversation` accepts a bounded query, validated domain/markets/product details and language. The existing source retrieval engine supplies official text and checks verbatim citations before returning draft claims. Source indices cannot establish substantive legal requirements. No cross-market equivalence is inferred.

`engine/regulatory_graph.py` returns version-addressed source records, draft requirement candidates and their evidence edges. SHA-256 identifies retrieved content. Retrieval date, effective date and translation status are distinct fields. A downloadable JSON record preserves the question, scoped market results and graph for review.

The catalogue contains 21 selected source connectors, including FDA, European Commission, MHRA, PMDA, MFDS, ANVISA, SFDA and APHA material. The legacy region codes FDA/EMA/MHRA denote markets in this API, not exclusive competent authorities: APHA sources belong to the UK market, not to MHRA's remit.

## Boundaries — do not market as complete global coverage

- Selected pages are retrieved on demand; this is not a complete legislative corpus.
- MFDS/SFDA document indices are discovery resources, not extracted legal provisions.
- Document dates, article/page locators, local applicability and original-language priority need review.
- Model quotation matching does not establish legal entailment.
- Source fingerprints identify versions within an exported response. A persistent historical repository, automated regulatory change monitor and reviewed crosswalk are not yet connected.
- The existing standalone document translator requires DeepL configuration; AI answer translations are labelled drafts and are never certified translations.
- ISO full text is not ingested. Appropriate AI/reproduction rights must be obtained first.
- Full submission workflows, automatic application filing and confidential tenant document storage are not enabled.

## Extension contract

Add authority and jurisdiction mappings separately. Extend the curated connector registry with rights, language and document-type metadata; verify each source before enabling retrieval. Use source/version identifiers for reviewed provisions, applicability predicates, procedure steps, required forms, translations and amendment relations. Unknown dates and unreviewed equivalence must remain unknown rather than being inferred from crawl time or title similarity.

Persist future version history in a durable store before enabling any change-monitoring UI. Production functions must not pretend a temporary filesystem is durable storage. Public metadata and confidential customer evidence require separate access controls.

## Validation

Python tests cover source failures, quote matching, unsupported markets, market clarification, input bounds, document-index exclusion, comparison isolation, existing translation/audit/auth controls and the new homepage. DOM tests cover progressive market selection, original-query retention, unsafe output escaping, request failure/retry and starting a new question. Browser visual/device QA is separate from these tests.
