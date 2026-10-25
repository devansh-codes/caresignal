"""Pure HAC Reduction Program math (FY2026 methodology).

Shared by hac_rebuild.py (validation against the official file), metrics.py (patients-to-prevent)
and mirrored in web/src/lib/simulate.ts. No I/O here.

Steps: winsorize each measure at its 5th/95th percentile -> z = (w - mean_w) / sd_w (higher = worse)
-> Total HAC Score = equal-weighted mean of the z-scores the hospital has -> penalized if total > cutoff,
the 75th percentile of non-Maryland Total HAC Scores.
"""

from __future__ import annotations

import math
from collections.abc import Mapping

import numpy as np

MEASURES = ("psi90", "clabsi", "cauti", "ssi", "cdi", "mrsa")
HAI_MEASURES = ("clabsi", "cauti", "ssi", "cdi", "mrsa")

# Conventions that best reproduce the official FY2026 W Z scores (see hac_rebuild.select_conventions).
PERCENTILE_METHOD = "linear"  # numpy default == Excel PERCENTILE.INC
SD_DDOF = 0  # population SD == Excel STDEV.P


def _clean(values) -> np.ndarray:
    a = np.asarray([v for v in values if v is not None], dtype=float)
    return a[~np.isnan(a)]


def winsor_bounds(values, lower: float = 5, upper: float = 95, method: str = PERCENTILE_METHOD) -> tuple[float, float]:
    """5th/95th percentile bounds over hospitals with a result."""
    a = _clean(values)
    if a.size == 0:
        raise ValueError("no values to winsorize")
    lo, hi = np.percentile(a, [lower, upper], method=method)
    return float(lo), float(hi)


def winsorize(v: float | None, lo: float, hi: float) -> float | None:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    return min(max(float(v), lo), hi)


def distribution_params(values, method: str = PERCENTILE_METHOD, ddof: int = SD_DDOF) -> dict:
    """winsor bounds plus mean/SD of the winsorized values."""
    a = _clean(values)
    lo, hi = winsor_bounds(a, method=method)
    w = np.clip(a, lo, hi)
    return {"winsor_low": lo, "winsor_high": hi, "mean": float(w.mean()), "sd": float(w.std(ddof=ddof)), "n": int(a.size)}


def zscore(w: float | None, mean: float, sd: float) -> float | None:
    if w is None or (isinstance(w, float) and math.isnan(w)):
        return None
    return (w - mean) / sd


def measure_z(v: float | None, p: Mapping[str, float]) -> float | None:
    """Raw measure value -> winsorized z using a params dict (winsor_low/high, mean, sd)."""
    return zscore(winsorize(v, p["winsor_low"], p["winsor_high"]), p["mean"], p["sd"])


def max_z(p: Mapping[str, float]) -> float:
    """z assigned at the upper winsorization bound (CMS assigns this when required data was not submitted)."""
    return (p["winsor_high"] - p["mean"]) / p["sd"]


def total_score(z_by_measure: Mapping[str, float | None]) -> tuple[float | None, dict[str, float]]:
    """Equal weights across the measures the hospital actually has. Returns (total, weights)."""
    present = {k: z for k, z in z_by_measure.items() if z is not None and not (isinstance(z, float) and math.isnan(z))}
    if not present:
        return None, {k: 0.0 for k in z_by_measure}
    w = 1.0 / len(present)
    weights = {k: (w if k in present else 0.0) for k in z_by_measure}
    return float(sum(z * w for z in present.values())), weights


def cutoff(totals, method: str = PERCENTILE_METHOD) -> float:
    """75th percentile of Total HAC Scores (caller passes non-Maryland hospitals with a score)."""
    a = _clean(totals)
    return float(np.percentile(a, 75, method=method))


def required_value_change(value: float | None, lo: float, hi: float, mean: float, sd: float,
                          weight: float, delta_total: float) -> float | None:
    """Reduction in the raw measure value (SIR or PSI 90 composite) needed to lower the hospital's
    Total HAC Score by `delta_total` (> 0), holding every other hospital and the cutoff constant.

    A value above the 95th-percentile cap must first fall to the cap before its z-score moves.
    Returns None when infeasible: no result/weight, or the 5th-percentile floor stops z from
    falling far enough.
    """
    if value is None or weight <= 0 or sd <= 0 or (isinstance(value, float) and math.isnan(value)):
        return None
    if delta_total <= 0:
        return 0.0
    w = min(max(value, lo), hi)
    target_w = w - (delta_total / weight) * sd
    if target_w < lo - 1e-12:
        return None
    # the hospital's raw value only needs to drop to target_w (which is <= hi)
    return float(value - target_w)


def required_value_increase(value: float | None, lo: float, hi: float, mean: float, sd: float,
                            weight: float, delta_total: float) -> float | None:
    """Mirror of required_value_change: the raw-value increase that would raise the Total HAC Score
    by `delta_total` (the cushion). A value below the 5th-percentile floor must first rise to the
    floor before its z-score moves. Returns None if the 95th-percentile cap makes it infeasible."""
    if value is None or weight <= 0 or sd <= 0 or (isinstance(value, float) and math.isnan(value)):
        return None
    if delta_total <= 0:
        return 0.0
    w = min(max(value, lo), hi)
    target_w = w + (delta_total / weight) * sd
    if target_w > hi + 1e-12:
        return None
    return float(target_w - value)


def events_from_sir_change(delta_sir: float | None, predicted: float | None) -> int | None:
    """SIR = observed / predicted, so a change in SIR is delta_sir * predicted infections.
    Rounded up to whole events (a tiny epsilon guards against float noise like 3.0000000001)."""
    if delta_sir is None or predicted is None or predicted <= 0 or (isinstance(predicted, float) and math.isnan(predicted)):
        return None
    return int(math.ceil(delta_sir * predicted - 1e-9))
