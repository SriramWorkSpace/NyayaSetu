"""
Bail prediction schemas (ARCHITECTURE.md section 6, section 4.2/4.3).

custody_days was removed from this contract (decisions.md D-017):
IndianBailJudgments-1200 never collected custody duration, so the trained
model could never use it. Asking for a field the model provably ignores is
worse than not asking - it reads as a bug or an oversight, not a real
constraint. Logged as a known data gap in ml/reports/MODEL_CARD_bail.md
rather than left as a silently-dead form field.

prior_record is a 3-state Literal, not a bool: "Unknown" is 49% of the
training corpus (near half, not an edge case), so collapsing it to a
boolean would mean a live user could never trigger the state the model
spent half its training seeing.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class BailPredictRequest(BaseModel):
    crime_category: str = Field(..., min_length=1, max_length=80)
    ipc_sections: list[str] = Field(..., min_length=1, max_length=20)
    prior_record: Literal["yes", "no", "unknown"]
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
