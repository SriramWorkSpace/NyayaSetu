"""
Artificial per-route latency for the Phase 3 stub.

Real model calls take real time; a stub that answers in 2ms trains the
frontend against conditions that never occur in the shipped app, and every
loading-skeleton decision gets made on a false premise. These numbers are
rough placeholders for what each module is expected to cost, replaced by
whatever the real model actually takes at Phase 9 (decisions.md D-002).
"""
from __future__ import annotations

import asyncio
import random


async def simulate(module: str) -> None:
    ranges = {
        "bail": (0.25, 0.55),
        "bail_baseline": (0.05, 0.15),
        "qa": (0.6, 1.1),
        "summarize": (0.8, 1.6),
        "scan": (1.2, 2.4),
        "search": (0.3, 0.7),
    }
    lo, hi = ranges.get(module, (0.1, 0.3))
    await asyncio.sleep(random.uniform(lo, hi))
