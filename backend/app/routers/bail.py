"""
POST /predict/bail and /predict/bail/baseline (ARCHITECTURE.md section 6).

Phase 9: real model calls, replacing the Phase 3 fixture stub. See
app/models/bail.py for which tier is served (XGBoost+TF-IDF, decisions.md
D-027/D-029) and the real, disclosed gap between what this model was
trained on and what the live API request actually collects.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.models import bail as bail_model
from app.schemas.bail import BailBaselineResponse, BailPredictRequest, BailPredictResponse
from app.schemas.envelope import Envelope, Timer, ok

router = APIRouter(tags=["bail"])


@router.post("/predict/bail", response_model=Envelope[BailPredictResponse])
async def predict_bail(payload: BailPredictRequest) -> Envelope[BailPredictResponse]:
    with Timer() as t:
        result = bail_model.predict(
            crime_category=payload.crime_category,
            ipc_sections=payload.ipc_sections,
            prior_record=payload.prior_record,
            narrative=payload.narrative,
        )
        data = BailPredictResponse(**result)
    return ok(data, t.ms)


@router.post("/predict/bail/baseline", response_model=Envelope[BailBaselineResponse])
async def predict_bail_baseline(payload: BailPredictRequest) -> Envelope[BailBaselineResponse]:
    with Timer() as t:
        result = bail_model.predict_baseline(
            crime_category=payload.crime_category,
            ipc_sections=payload.ipc_sections,
            prior_record=payload.prior_record,
            narrative=payload.narrative,
        )
        data = BailBaselineResponse(**result)
    return ok(data, t.ms)
