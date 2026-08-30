"""
PyInstaller entry point. `python -m uvicorn app.main:app` (the normal dev
command, CLAUDE.md section 8) needs a real Python interpreter and package
resolution at the command line - neither exists in a frozen bundle, which is
one baked executable, not an interpreter you can hand a module path to. This
script imports the same `app` object directly and runs it programmatically,
so PyInstaller has a single, ordinary entry function to freeze.
"""
from __future__ import annotations

import uvicorn

from app.main import app

if __name__ == "__main__":
    # 127.0.0.1 only, matching app/main.py's own binding rule
    # (SECURITY.md section 2) - reasserted here since this is the actual
    # process a packaged install runs, not just the dev `uvicorn` command.
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
