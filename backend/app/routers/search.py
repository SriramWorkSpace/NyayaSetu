"""POST /search/precedent."""
from __future__ import annotations

from app.fixtures import search_results
from app.latency import simulate
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.search import SearchRequest, SearchResponse

from fastapi import APIRouter

router = APIRouter(tags=["search"])


@router.post("/search/precedent", response_model=Envelope[SearchResponse])
async def search_precedent(payload: SearchRequest) -> Envelope[SearchResponse]:
    with Timer() as t:
        await simulate("search")
        if payload.query.strip().lower() == "__empty__":
            data = SearchResponse(results=[])
        else:
            all_results = search_results()["results"]
            data = SearchResponse(results=all_results[: payload.top_k])
    return ok(data, t.ms)
