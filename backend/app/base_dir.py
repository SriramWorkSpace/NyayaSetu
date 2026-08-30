"""
Frozen-aware path roots, shared by every module that resolves a bundled data
file (trained weights, ml/reports/*.json, the vendored Tesseract binary).

In dev, `__file__`-relative paths (backend/app/base_dir.py -> parents[1] is
backend/, parents[2] is the repo root) are exactly what every model module
already assumed. Under PyInstaller, there is no real "backend/app/" on disk
at runtime - only the bundle's own extraction root, `sys._MEIPASS` (set by
PyInstaller, not a normal Python attribute - checked via getattr, not
assumed present). The PyInstaller spec's `--add-data` mirrors the repo's own
relative layout into that bundle root (backend/artifacts/, ml/reports/,
backend/vendor/), so `repo_root()` / `backend_dir()` resolve to the right
place either way with no caller-side branching.
"""
from __future__ import annotations

import sys
from pathlib import Path


def repo_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parents[2]


def backend_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "backend"  # type: ignore[attr-defined]
    return Path(__file__).resolve().parents[1]
