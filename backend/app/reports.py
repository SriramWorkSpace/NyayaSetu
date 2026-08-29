"""
Reads ml/reports/*.json for GET /metrics/{module} - the live numbers Phase 6-8
actually produced. Replaces app/fixtures.py's metrics_for() now that Phase 9
deletes the fixture stub entirely (plan.md Phase 9: "delete the fixtures").
No caching: these files change only when ml/ retrains something and the
backend restarts, but re-reading is cheap and keeps this honestly live
rather than stale-until-restart in the one case that matters least.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPORTS_DIR = Path(__file__).resolve().parents[2] / "ml" / "reports"


def metrics_for(module: str) -> dict[str, Any] | None:
    path = REPORTS_DIR / f"{module}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
