"""
Fetch IndianBailJudgments-1200 (CC BY 4.0) into ml/data/bail/.

huggingface.co/datasets/SnehaDeshmukh/IndianBailJudgments-1200

Saves the raw JSON records verbatim plus a small schema/sample dump so the
first run can be inspected before any feature code is written against
assumptions about field names.
"""
from __future__ import annotations

import json
from pathlib import Path

from huggingface_hub import hf_hub_download

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "bail"
DATASET_ID = "SnehaDeshmukh/IndianBailJudgments-1200"


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # The dataset ships JSON/CSV/XLSX plus 1,200 source PDFs. JSON is what
    # we need for training; the PDFs are pulled separately, later, only when
    # the scan module needs real test documents (README licensing table).
    path = hf_hub_download(repo_id=DATASET_ID, filename="indian_bail_judgments.json", repo_type="dataset")
    dest = DATA_DIR / "raw.json"
    dest.write_bytes(Path(path).read_bytes())

    records = json.loads(dest.read_text(encoding="utf-8"))
    print(f"Fetched {len(records)} records -> {dest}")

    sample = records[:3]
    (DATA_DIR / "sample.json").write_text(json.dumps(sample, indent=2, ensure_ascii=False), encoding="utf-8")

    if records:
        keys = sorted(records[0].keys())
        print("Fields:", keys)
        (DATA_DIR / "_schema.txt").write_text("\n".join(keys), encoding="utf-8")


if __name__ == "__main__":
    main()
