"""GET /health."""
from __future__ import annotations

import time

from fastapi import APIRouter

from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.metrics import HealthResponse

router = APIRouter(tags=["health"])

START_TIME = time.monotonic()

# Phase 3: no real models exist yet, so this list is the routes that ANSWER,
# not models that LOADED. Phase 9 replaces this with the real singleton
# registry populated at startup (CLAUDE.md section 3).
STUB_MODULES = ["bail (fixture)", "qa (fixture)", "summarization (fixture)",
                 "retrieval (fixture)", "ner (fixture)"]


@router.get("/health", response_model=Envelope[HealthResponse])
async def health() -> Envelope[HealthResponse]:
    with Timer() as t:
        data = HealthResponse(
            status="ok",
            models_loaded=STUB_MODULES,
            uptime_s=round(time.monotonic() - START_TIME, 2),
        )
    return ok(data, t.ms)
