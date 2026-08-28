"""
Document scan schemas.

No summary field here on purpose: /scan/extract never auto-summarizes.
Summarization is a second, explicit /summarize call the user triggers
themselves (ARCHITECTURE.md section 2.1, section 4.4).
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class ScanEntities(BaseModel):
    case_number: str | None = None
    court: str | None = None
    parties: list[str] = Field(default_factory=list)
    ipc_sections: list[str] = Field(default_factory=list)
    dates: list[str] = Field(default_factory=list)


class ScanExtractResponse(BaseModel):
    raw_text: str
    ocr_confidence: float = Field(..., ge=0, le=1)
    entities: ScanEntities
    # OCR error and extraction error are always reported separately
    # (CLAUDE.md section 7, ARCHITECTURE.md section 7 reporting rule).
    field_confidence: dict[str, float]
