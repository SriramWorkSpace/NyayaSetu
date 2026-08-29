"""POST /search/precedent. Phase 9: real FAISS search over the retrieval corpus."""
from __future__ import annotations

from fastapi import APIRouter

from app.models import retrieval as retrieval_model
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.search import SearchRequest, SearchResponse

router = APIRouter(tags=["search"])


@router.post("/search/precedent", response_model=Envelope[SearchResponse])
async def search_precedent(payload: SearchRequest) -> Envelope[SearchResponse]:
    with Timer() as t:
        results = retrieval_model.search(payload.query, payload.top_k)
        data = SearchResponse(results=results)
    return ok(data, t.ms)
