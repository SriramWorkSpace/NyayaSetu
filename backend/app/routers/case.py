"""GET /case/{case_id}. Additive to the section 6 contract - see decisions.md D-013."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.fixtures import case_detail
from app.schemas.case import CaseDetail
from app.schemas.envelope import Envelope, Timer, ok

router = APIRouter(tags=["case"])


@router.get("/case/{case_id}", response_model=Envelope[CaseDetail])
async def get_case(case_id: str) -> Envelope[CaseDetail]:
    with Timer() as t:
        raw = case_detail(case_id)
        if raw is None:
            raise HTTPException(status_code=404, detail="case_not_found")
        data = CaseDetail(**raw)
    return ok(data, t.ms)
