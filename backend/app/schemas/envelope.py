"""
The response envelope every endpoint returns (ARCHITECTURE.md section 6):

    { ok, data, error, latency_ms }

One generic wraps every route so a client never has to guess the shape of a
failure. `data` and `error` are mutually exclusive by construction: build an
envelope with exactly one of them, never both.
"""
from __future__ import annotations

import time
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str


class Envelope(BaseModel, Generic[T]):
    ok: bool
    data: T | None = None
    error: ErrorDetail | None = None
    latency_ms: float


class Timer:
    """`with Timer() as t: ...` then `t.ms` for the envelope's latency_ms."""

    def __enter__(self) -> "Timer":
        self._start = time.perf_counter()
        return self

    def __exit__(self, *exc: object) -> None:
        self.ms = round((time.perf_counter() - self._start) * 1000, 2)


def ok(data: T, latency_ms: float) -> Envelope[T]:
    return Envelope(ok=True, data=data, error=None, latency_ms=latency_ms)


def fail(code: str, message: str, latency_ms: float) -> Envelope[None]:
    return Envelope(ok=False, data=None, error=ErrorDetail(code=code, message=message), latency_ms=latency_ms)
