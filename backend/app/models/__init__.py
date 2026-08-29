"""
Loads every model singleton once at FastAPI startup (CLAUDE.md section 3:
"Models load ONCE at startup... hard rule. Log a timestamp per model at
load and verify it fires exactly once per process.").

`_loaded` guards against a second call actually reloading anything - if
uvicorn's --reload ever fires the startup event twice in one process (it
should not, but this is the thing CLAUDE.md says to verify, not assume), the
second call is a no-op and logs a warning rather than silently re-loading
~1GB of models.
"""
from __future__ import annotations

import logging
import time

from app.models import bail, ner, ocr, qa, retrieval, summarization

logger = logging.getLogger("nyayasetu.models")

_loaded = False
MODULE_NAMES = ["bail", "qa", "summarization", "retrieval", "ner"]


def load_all() -> list[str]:
    global _loaded
    if _loaded:
        logger.warning("load_all() called again after models were already loaded - ignoring, not reloading.")
        return MODULE_NAMES

    t0 = time.perf_counter()
    bail.load()
    qa.load()
    summarization.load()
    retrieval.load()
    ner.load()
    # ocr.py has no model weights to load - pytesseract just needs the
    # binary path set, done at import time in that module.
    _loaded = True
    logger.info("All 5 model singletons loaded in %.2fs total", time.perf_counter() - t0)
    return MODULE_NAMES


def is_loaded() -> bool:
    return _loaded
