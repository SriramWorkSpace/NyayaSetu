"""Summarization schemas. text/case_id: exactly one must be given."""
from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class SummarizeRequest(BaseModel):
    text: str | None = Field(default=None, max_length=200_000)
    case_id: str | None = None
    max_sentences: int = Field(default=5, ge=1, le=30)

    @model_validator(mode="after")
    def exactly_one_source(self) -> "SummarizeRequest":
        if bool(self.text) == bool(self.case_id):
            raise ValueError("Provide exactly one of `text` or `case_id`, not both or neither.")
        return self


class SummarizeResponse(BaseModel):
    summary_sentences: list[str]
    source_indices: list[int]
    compression_ratio: float = Field(..., ge=0, le=1)
