"""Patients-to-prevent on hand-checked synthetic examples (plan §4.2).

Shared params: winsor 0..2, mean 1.0, SD 0.5 for every measure; two measures present -> weight 0.5.
"""

import pytest

from pipeline.metrics import cushion_events, patients_to_prevent, tipping

P = {m: {"winsor_low": 0.0, "winsor_high": 2.0, "mean": 1.0, "sd": 0.5, "n": 100}
     for m in ("psi90", "clabsi", "cauti", "ssi", "cdi", "mrsa")}
W = {"psi90": 0.0, "clabsi": 0.0, "cauti": 0.5, "ssi": 0.0, "cdi": 0.5, "mrsa": 0.0}


def _row(rows, m):
    return next(r for r in rows if r["measure"] == m)


def test_basic_gap():
    # gap 0.2 -> dz = 0.4 -> dSIR = 0.4 * 0.5 = 0.2 -> 0.2 * 12 predicted = 2.4 -> 3 CAUTIs
    rows = patients_to_prevent({"cauti": 1.5, "cdi": 1.0}, W, {"cauti": 12.0, "cdi": 30.0}, P, 0.2)
    r = _row(rows, "cauti")
    assert r["feasible"] and r["events"] == 3
    assert r["delta_sir"] == pytest.approx(0.2)
    # CDI: same dSIR 0.2 * 30 = 6 events exactly
    assert _row(rows, "cdi")["events"] == 6
    assert tipping(rows) == ("cauti", 3)


def test_value_above_winsor_cap_must_first_fall_to_cap():
    # SIR 3.0 is capped at 2.0; target 2.0 - 0.2 = 1.8 -> dSIR 1.2 -> 14.4 -> 15
    rows = patients_to_prevent({"cauti": 3.0, "cdi": 1.0}, W, {"cauti": 12.0, "cdi": 30.0}, P, 0.2)
    assert _row(rows, "cauti")["events"] == 15


def test_floor_makes_measure_infeasible():
    # gap 1.0 -> dz 2 -> target 0.2 - 1.0 < floor 0
    rows = patients_to_prevent({"cauti": 0.2, "cdi": 1.0}, W, {"cauti": 12.0, "cdi": 30.0}, P, 1.0)
    r = _row(rows, "cauti")
    assert not r["feasible"] and r["events"] is None and "floor" in r["reason"]


def test_missing_measure_and_missing_predicted():
    rows = patients_to_prevent({"cauti": 1.5, "cdi": 1.0}, W, {"cauti": None, "cdi": 30.0}, P, 0.2)
    assert "predicted" in _row(rows, "cauti")["reason"]
    assert _row(rows, "mrsa")["reason"] == "No result for this measure"


def test_psi90_never_has_event_count():
    w = {**W, "psi90": 1 / 3, "cauti": 1 / 3, "cdi": 1 / 3}
    rows = patients_to_prevent({"psi90": 1.2, "cauti": 1.5, "cdi": 1.0}, w, {"cauti": 12.0}, P, 0.1)
    r = _row(rows, "psi90")
    assert not r["feasible"] and r["events"] is None and r["delta_sir"] > 0 and "composite" in r["reason"]


def test_already_clear():
    rows = patients_to_prevent({"cauti": 1.5, "cdi": 1.0}, W, {"cauti": 12.0}, P, -0.1)
    assert _row(rows, "cauti")["events"] == 0
    assert tipping(rows) == (None, None)


def test_cushion_events_strictly_cross():
    # gap -0.1 -> margin 0.1 -> dz 0.2 -> dSIR 0.1 -> 1.2 -> 2 added CAUTIs
    rows = cushion_events({"cauti": 1.0, "cdi": 1.0}, W, {"cauti": 12.0, "cdi": 10.0}, P, -0.1)
    assert _row(rows, "cauti")["events"] == 2
    # CDI: 0.1 * 10 = 1.0 exactly; reaching the cutoff is not crossing it, so 2 events
    assert _row(rows, "cdi")["events"] == 2


def test_cushion_cap_infeasible():
    # value 1.9, margin 0.5 -> target 1.9 + 0.5 = 2.4 > cap 2.0
    rows = cushion_events({"cauti": 1.9, "cdi": 1.0}, W, {"cauti": 12.0}, P, -0.5)
    assert not _row(rows, "cauti")["feasible"]


def test_not_submitted_measure_with_max_z():
    # weight > 0 but no value: CMS assigned the max z (footnote 18)
    rows = patients_to_prevent({"ssi": None}, {**W, "cauti": 0.0, "cdi": 0.0, "ssi": 1.0}, {}, P, 1.0)
    assert "footnote 18" in _row(rows, "ssi")["reason"]
