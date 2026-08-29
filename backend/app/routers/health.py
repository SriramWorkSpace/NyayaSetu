"""GET /health. Phase 9: reflects the real singleton registry, populated once at startup."""
from __future__ import annotations

import time

from fastapi import APIRouter

from app.models import MODULE_NAMES, is_loaded
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.metrics import HealthResponse

router = APIRouter(tags=["health"])

START_TIME = time.monotonic()


@router.get("/health", response_model=Envelope[HealthResponse])
async def health() -> Envelope[HealthResponse]:
    with Timer() as t:
        data = HealthResponse(
            status="ok" if is_loaded() else "warming_up",
            models_loaded=MODULE_NAMES if is_loaded() else [],
            uptime_s=round(time.monotonic() - START_TIME, 2),
        )
    return ok(data, t.ms)
