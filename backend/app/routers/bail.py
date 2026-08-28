"""
POST /predict/bail and /predict/bail/baseline (ARCHITECTURE.md section 6).

Stub selection rule: crime_category == "__error__" forces the error path for
building error states. prior_record == "unknown" forces the low-confidence
fixture - a real semantic mapping rather than a magic sentinel value: a case
where prior record is genuinely unknown is exactly the kind of case a model
should be less confident about, and "unknown" is 49% of the training corpus
(decisions.md D-017), so this is honest behaviour, not just a test hook.
None of this logic survives Phase 9 - it exists only so the frontend has
something coherent to build the empty/loading/error states against.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.fixtures import bail_case
from app.latency import simulate
from app.schemas.bail import BailBaselineResponse, BailPredictRequest, BailPredictResponse
from app.schemas.envelope import Envelope, Timer, ok

router = APIRouter(tags=["bail"])


def _select_key(payload: BailPredictRequest) -> str:
    if payload.prior_record == "unknown":
        return "low_confidence"
    return "denied" if payload.prior_record == "yes" else "granted"


@router.post("/predict/bail", response_model=Envelope[BailPredictResponse])
async def predict_bail(payload: BailPredictRequest) -> Envelope[BailPredictResponse]:
    with Timer() as t:
        await simulate("bail")
        if payload.crime_category == "__error__":
            raise HTTPException(status_code=503, detail="model_unavailable")
        data = BailPredictResponse(**bail_case(_select_key(payload)))
    return ok(data, t.ms)


@router.post("/predict/bail/baseline", response_model=Envelope[BailBaselineResponse])
async def predict_bail_baseline(payload: BailPredictRequest) -> Envelope[BailBaselineResponse]:
    with Timer() as t:
        await simulate("bail_baseline")
        key = "baseline_denied" if payload.prior_record == "yes" else "baseline_granted"
        data = BailBaselineResponse(**bail_case(key))
    return ok(data, t.ms)
