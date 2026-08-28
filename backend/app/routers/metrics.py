"""
GET /metrics/{module}. Read by the Model Insights screen and nothing else;
no side effects, safe to poll (ARCHITECTURE.md section 6).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.fixtures import metrics_for
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.metrics import ModuleMetrics

router = APIRouter(tags=["metrics"])

VALID_MODULES = {"bail", "qa", "summarization", "retrieval", "ner"}


@router.get("/metrics/{module}", response_model=Envelope[ModuleMetrics])
async def get_metrics(module: str) -> Envelope[ModuleMetrics]:
    with Timer() as t:
        if module not in VALID_MODULES:
            raise HTTPException(status_code=404, detail="unknown_module")
        raw = metrics_for(module)
        if raw is None:
            raise HTTPException(status_code=404, detail="unknown_module")
        data = ModuleMetrics(**raw)
    return ok(data, t.ms)
