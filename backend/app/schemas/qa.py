"""Extractive QA schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class QaExtractRequest(BaseModel):
    case_id: str
    question: str = Field(..., min_length=1, max_length=500)


class QaExtractResponse(BaseModel):
    answer_span: str
    char_start: int = Field(..., ge=0)
    char_end: int = Field(..., ge=0)
    score: float = Field(..., ge=0, le=1)
