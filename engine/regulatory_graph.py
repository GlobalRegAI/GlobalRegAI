"""Response-level knowledge graph with provenance, explicit unknown dates and rights.

Only exact-quotation-checked draft claims become requirement candidates. No
cross-country equivalence or legal effect is inferred from a page retrieval.
"""
from pydantic import BaseModel, Field
from typing import Literal


class DocumentVersion(BaseModel):
    id: str
    source_id: str
    jurisdiction: str
    title: str
    url: str
    document_type: str = 'guidance'
    content_sha256: str | None = None
    retrieved_at: str | None = None
    effective_date: str | None = None
    effective_date_status: Literal['unverified'] = 'unverified'
    translation_status: str = 'original_or_unspecified'
    retrieval_status: str


class RequirementCandidate(BaseModel):
    id: str
    statement: str
    document_version_id: str
    quotation: str
    locator: str = 'Exact quotation; article/page not established'
    status: Literal['draft_requires_review'] = 'draft_requires_review'
    translation_status: Literal['ai_generated_not_certified'] = 'ai_generated_not_certified'


class RegulatoryGraph(BaseModel):
    schema_version: str = '1.0'
    documents: list[DocumentVersion] = Field(default_factory=list)
    requirements: list[RequirementCandidate] = Field(default_factory=list)
    relationships: list[dict[str, str]] = Field(default_factory=list)
    coverage: Literal['partial'] = 'partial'
    change_monitoring: Literal['not_connected'] = 'not_connected'


def build_graph(groups):
    graph = RegulatoryGraph()
    for group in groups:
        versions = {}
        for source in group.get('sources', []):
            sid = source['id']
            digest = source.get('content_sha256')
            vid = sid + ':' + (digest or 'unretrieved')
            versions[sid] = vid
            graph.documents.append(DocumentVersion(id=vid, source_id=sid,
                jurisdiction=group['target_region'], title=source['title'], url=source['url'],
                document_type=source.get('document_type','guidance'), content_sha256=digest,
                retrieved_at=source.get('retrieved_at'), retrieval_status=source.get('retrieval_status','UNAVAILABLE'),
                translation_status=source.get('translation_status','original_or_unspecified')))
        for index, claim in enumerate(group.get('claims', [])):
            sid = claim['source_id']
            if sid not in versions:
                continue
            rid = group['target_region'] + ':claim:' + str(index)
            graph.requirements.append(RequirementCandidate(id=rid, statement=claim['statement'],
                document_version_id=versions[sid], quotation=claim['quote']))
            graph.relationships.append({'from':rid,'type':'supported_by_quote','to':versions[sid]})
    return graph.model_dump()
