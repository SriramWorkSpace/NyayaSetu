"""
/metrics/{module} schemas.

This is what the Model Insights screen reads (ARCHITECTURE.md section 4.7,
section 2.2 #10-11). No side effects; safe to poll.
"""
from __future__ import annotations

from pydantic import BaseModel


class MetricPoint(BaseModel):
    metric_name: str
    value: float


class CalibrationPoint(BaseModel):
    predicted: float
    observed: float


class FairnessAudit(BaseModel):
    metric: str
    gap_before: float
    gap_after: float


class ModuleMetrics(BaseModel):
    baseline: list[MetricPoint]
    final: list[MetricPoint]
    calibration_points: list[CalibrationPoint] | None = None
    fairness: FairnessAudit | None = None
    dataset_size: int
    last_trained: str | None  # ISO 8601, or null if never trained


class HealthResponse(BaseModel):
    status: str
    models_loaded: list[str]
    uptime_s: float
