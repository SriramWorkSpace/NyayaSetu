"""Bail prediction schemas (ARCHITECTURE.md section 6, section 4.2/4.3)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class BailPredictRequest(BaseModel):
    crime_category: str = Field(..., min_length=1, max_length=80)
    ipc_sections: list[str] = Field(..., min_length=1, max_length=20)
    custody_days: int = Field(..., ge=0, le=20000)
    prior_record: bool
    narrative: str | None = Field(default=None, max_length=8000)


class ShapFactor(BaseModel):
    name: str
    direction: str  # "for_grant" | "for_denial"
    weight: float


class BailPredictResponse(BaseModel):
    outcome: str  # "granted" | "denied"
    probability: float = Field(..., ge=0, le=1)
    confidence_band: str  # "low" | "medium" | "high"
    factors: list[ShapFactor]
    model_version: str


class BailBaselineResponse(BaseModel):
    outcome: str
    probability: float = Field(..., ge=0, le=1)
    model_name: str
