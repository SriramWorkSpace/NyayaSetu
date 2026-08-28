"""Precedent retrieval schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(default=10, ge=1, le=50)


class SearchResult(BaseModel):
    case_id: str
    title: str
    court: str
    year: int
    score: float = Field(..., ge=0, le=1)
    snippet: str


class SearchResponse(BaseModel):
    results: list[SearchResult]
