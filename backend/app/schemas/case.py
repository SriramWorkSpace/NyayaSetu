"""
GET /case/{case_id} - not in ARCHITECTURE.md section 6.

Case Detail (section 4.6) needs full judgment text, and /qa/extract already
takes a case_id assuming the backend can resolve it to a document - section 6
never says how. This is the minimal, additive, non-breaking endpoint that
resolves both: fetch a case by id. Logged as decisions.md D-013 rather than
silently added.
"""
from __future__ import annotations

from pydantic import BaseModel


class CaseDetail(BaseModel):
    case_id: str
    title: str
    court: str
    year: int
    case_number: str
    ipc_sections: list[str]
    full_text: str
    summary_sentences: list[str]
    source_indices: list[int]
