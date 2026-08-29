"""
Extractive QA singleton. Loads the fine-tuned InLegalBERT span-prediction
head from ml/reports (via backend/artifacts/qa), and decodes exactly as
ml/src/train/train_qa.py's own evaluation loop does - same tokenization
(max_length=384, truncation="only_second"), same argmax-over-logits
decoding, same char-offset mapping back to the source text.

`score` is softmax(start_logits)[start] * softmax(end_logits)[end] - not
computed in the training script (which only needed exact-match/F1 against
gold spans), added here because the API contract requires a confidence
score. Verified against a real example before trusting it: a clear,
unambiguous question produced the correct sentence with a 0.83 score - a
sane number for a genuinely confident extraction.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path

import torch
import torch.nn.functional as F
from transformers import AutoModelForQuestionAnswering, AutoTokenizer

logger = logging.getLogger("nyayasetu.models.qa")

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "qa" / "inlegalbert_qa"
MAX_SEQ_LEN = 384

_state: dict = {}


def load() -> None:
    t0 = time.perf_counter()
    _state["tokenizer"] = AutoTokenizer.from_pretrained(ARTIFACTS_DIR)
    model = AutoModelForQuestionAnswering.from_pretrained(ARTIFACTS_DIR)
    model.eval()
    _state["model"] = model
    logger.info("QA model (fine-tuned InLegalBERT) loaded in %.2fs", time.perf_counter() - t0)


def extract(context: str, question: str) -> dict:
    tokenizer = _state["tokenizer"]
    model = _state["model"]

    enc = tokenizer(
        question, context, max_length=MAX_SEQ_LEN, truncation="only_second",
        return_offsets_mapping=True, return_tensors="pt",
    )
    offsets = enc.pop("offset_mapping")[0]

    with torch.no_grad():
        out = model(**enc)

    start_idx = int(torch.argmax(out.start_logits))
    end_idx = int(torch.argmax(out.end_logits))
    if end_idx < start_idx:
        end_idx = start_idx

    start_char = int(offsets[start_idx][0])
    end_char = int(offsets[end_idx][1])
    answer_span = context[start_char:end_char]

    start_prob = F.softmax(out.start_logits, dim=-1)[0, start_idx].item()
    end_prob = F.softmax(out.end_logits, dim=-1)[0, end_idx].item()
    score = round(start_prob * end_prob, 4)

    return {
        "answer_span": answer_span,
        "char_start": start_char,
        "char_end": end_char,
        "score": score,
    }
