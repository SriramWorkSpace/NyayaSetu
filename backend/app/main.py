"""
NyayaSetu backend - Phase 9: real model calls.

Every ARCHITECTURE.md section 6 endpoint now calls the actual trained models
(app/models/) instead of the Phase 3 fixture stub (decisions.md D-002 - the
whole point of freezing the contract early was that this swap touches
router bodies only, never the schemas or the frontend).

Binds to 127.0.0.1 only - never 0.0.0.0 (SECURITY.md section 2).
"""
from __future__ import annotations

import os

# Must be set before any transformers/sentence-transformers/huggingface_hub
# import - SECURITY.md section 2: "no outbound call the user didn't
# initiate." Without this, SentenceTransformer.__init__ makes ~15 HTTPS
# HEAD/GET requests to huggingface.co on every single startup just to
# re-verify a cache that is already present and correct - caught by
# reading this process's own startup log, not assumed to be offline by
# default. All five models load from local artifacts; none need the network
# once downloaded once during training.
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.models import load_all
from app.routers import bail, case, health, metrics, qa, scan, search, summarize
from app.schemas.envelope import fail

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("nyayasetu")

app = FastAPI(title="NyayaSetu API", version="0.9.0")

# Vite dev ports only. The shipped app routes through @tauri-apps/plugin-http,
# which bypasses browser CORS entirely - this exists purely so `vite dev` in a
# plain browser tab keeps working while iterating on the frontend alone
# (ARCHITECTURE.md section 5.3).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def time_request(request: Request, call_next):
    request.state.start = time.perf_counter()
    return await call_next(request)


def _elapsed_ms(request: Request) -> float:
    start = getattr(request.state, "start", None)
    return round((time.perf_counter() - start) * 1000, 2) if start else 0.0


# Every response on the wire matches the { ok, data, error, latency_ms }
# envelope, including failures - a caught exception is not exempt from the
# contract (ARCHITECTURE.md section 6). Never leak a stack trace to the
# client (SECURITY.md section 2); log it server-side instead.
@app.exception_handler(HTTPException)
async def envelope_http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code >= 500:
        logger.warning("HTTPException %s on %s: %s", exc.status_code, request.url.path, exc.detail)
    body = fail(code=str(exc.status_code), message=str(exc.detail), latency_ms=_elapsed_ms(request))
    return JSONResponse(status_code=exc.status_code, content=body.model_dump())


@app.exception_handler(RequestValidationError)
async def envelope_validation_exception_handler(request: Request, exc: RequestValidationError):
    message = "; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors())
    body = fail(code="422", message=message, latency_ms=_elapsed_ms(request))
    return JSONResponse(status_code=422, content=body.model_dump())


@app.exception_handler(Exception)
async def envelope_unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    body = fail(code="500", message="Internal server error. Check the backend logs.", latency_ms=_elapsed_ms(request))
    return JSONResponse(status_code=500, content=body.model_dump())


API_PREFIX = "/api/v1"
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(bail.router, prefix=API_PREFIX)
app.include_router(qa.router, prefix=API_PREFIX)
app.include_router(summarize.router, prefix=API_PREFIX)
app.include_router(scan.router, prefix=API_PREFIX)
app.include_router(search.router, prefix=API_PREFIX)
app.include_router(metrics.router, prefix=API_PREFIX)
app.include_router(case.router, prefix=API_PREFIX)


@app.on_event("startup")
async def warm_models() -> None:
    # Triggered inside FastAPI's startup event so warm-up is already paid by
    # the time uvicorn prints "Application startup complete" (ARCHITECTURE.md
    # section 10). Each model logs its own load time; app.models.load_all()
    # additionally guards against firing more than once per process
    # (CLAUDE.md section 3's hard rule).
    loaded = load_all()
    logger.info("Backend ready - serving real models: %s", ", ".join(loaded))
