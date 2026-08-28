# NyayaSetu backend

FastAPI stub implementing the full ARCHITECTURE.md section 6 contract against
JSON fixtures (`app/fixtures/`). No models load in this phase - every route
answers from `app/fixtures/*.json` via `app/fixtures.py`, with artificial
latency (`app/latency.py`) so the frontend is built against realistic timing
rather than an instant response that never occurs once real models are wired
in (Phase 9).

## Run

```bash
py -3.11 -m venv .venv
.venv/Scripts/activate          # Windows; macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Binds to `127.0.0.1` only - see SECURITY.md.

## Fixture triggers

For building empty/loading/error states deliberately, not by accident:

| Route | Trigger | Result |
|---|---|---|
| `/predict/bail` | `crime_category: "__error__"` | 503 |
| `/predict/bail` | `custody_days: 999` | low-confidence fixture |
| `/predict/bail` | `prior_record: true` | denied fixture; `false` | granted |
| `/qa/extract` | `question: "__error__"` | 503 |
| `/qa/extract` | question without `?` | low-confidence fixture |
| `/summarize` | `text` or `case_id: "__error__"` | 503 |
| `/scan/extract` | filename containing `lowquality` | low-quality OCR fixture |
| `/scan/extract` | wrong MIME type / empty file | 415 / 422 |
| `/search/precedent` | `query: "__empty__"` | empty results |
| `/metrics/{module}` | unknown module name | 404 |

Every response, including every error above, matches the
`{ ok, data, error, latency_ms }` envelope - see `app/main.py`'s exception
handlers.

## What Phase 9 changes

Router bodies swap fixture reads (`app/fixtures.py`) for real model calls.
Routes, schemas (`app/schemas/`), and every frontend caller are unchanged
(decisions.md D-002).
