"""
Loads the Phase 3 stub fixtures (app/fixtures/*.json).

This module is the entire seam Phase 9 removes: every router imports from
here, never from a JSON file path directly, so swapping fixture reads for
real model calls touches router bodies only, never callers of the routers
(decisions.md D-002).
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@lru_cache(maxsize=None)
def _load(name: str) -> dict[str, Any]:
    with open(FIXTURES_DIR / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def bail_case(key: str) -> dict[str, Any]:
    return _load("bail")[key]


def qa_case(key: str) -> dict[str, Any]:
    return _load("qa")[key]


def summarize_case(key: str) -> dict[str, Any]:
    return _load("summarize")[key]


def scan_case(key: str) -> dict[str, Any]:
    return _load("scan")[key]


def search_results() -> dict[str, Any]:
    return _load("search")


def metrics_for(module: str) -> dict[str, Any] | None:
    return _load("metrics").get(module)
