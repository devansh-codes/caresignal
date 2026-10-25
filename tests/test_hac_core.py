"""Unit tests for the pure HAC math, using hand-computed examples."""

import math

import numpy as np
import pytest

from pipeline import hac_core as hc


def test_winsor_bounds_linear_matches_excel_percentile_inc():
    vals = list(range(1, 22))  # 1..21 -> rank 0.05*20 = 1 -> 2.0 ; 0.95*20 = 19 -> 20.0
    assert hc.winsor_bounds(vals, method="linear") == (2.0, 20.0)


def test_winsor_bounds_ignores_missing():
    assert hc.winsor_bounds([None, 1.0, float("nan"), 3.0], method="linear") == pytest.approx((1.1, 2.9))


def test_winsor_bounds_empty_raises():
    with pytest.raises(ValueError):
        hc.winsor_bounds([None, float("nan")])


@pytest.mark.parametrize("v,expected", [(0.5, 1.0), (1.5, 1.5), (9.0, 2.0), (1.0, 1.0), (2.0, 2.0), (None, None)])
def test_winsorize_clips_to_bounds(v, expected):
    assert hc.winsorize(v, 1.0, 2.0) == expected


def test_zscore_and_measure_z():
    p = {"winsor_low": 0.0, "winsor_high": 2.0, "mean": 1.0, "sd": 0.5}
    assert hc.zscore(1.5, 1.0, 0.5) == pytest.approx(1.0)
    assert hc.measure_z(5.0, p) == pytest.approx(2.0)  # capped at 2.0 -> (2-1)/0.5
    assert hc.measure_z(-1.0, p) == pytest.approx(-2.0)
    assert hc.measure_z(None, p) is None
    assert hc.max_z(p) == pytest.approx(2.0)


def test_distribution_params_hand_example():
    # values 0..20; linear p5 = 1, p95 = 19 -> winsorized: 1,1,2..19,19 ; mean = 10
    p = hc.distribution_params(list(range(21)), method="linear", ddof=0)
    w = np.clip(np.arange(21), 1, 19)
    assert p["winsor_low"] == 1.0 and p["winsor_high"] == 19.0
    assert p["mean"] == pytest.approx(10.0)
    assert p["sd"] == pytest.approx(w.std())
    assert p["n"] == 21


def test_total_score_equal_weights_all_six():
    z = {"psi90": 0.6, "clabsi": -0.6, "cauti": 1.2, "ssi": 0.0, "cdi": 0.3, "mrsa": -0.3}
    total, w = hc.total_score(z)
    assert total == pytest.approx(1.2 / 6)
    assert all(v == pytest.approx(1 / 6) for v in w.values())


def test_total_score_renormalizes_missing_measures():
    z = {"psi90": 1.0, "clabsi": None, "cauti": 2.0, "ssi": float("nan"), "cdi": None, "mrsa": None}
    total, w = hc.total_score(z)
    assert total == pytest.approx(1.5)
    assert w == {"psi90": 0.5, "clabsi": 0.0, "cauti": 0.5, "ssi": 0.0, "cdi": 0.0, "mrsa": 0.0}


def test_total_score_no_measures():
    total, w = hc.total_score({"psi90": None, "cauti": None})
    assert total is None and set(w.values()) == {0.0}


def test_cutoff_is_75th_percentile():
    assert hc.cutoff([0, 1, 2, 3, 4], method="linear") == pytest.approx(3.0)


def test_required_value_change_simple():
    # weight 1/5, sd 0.4: lowering total by 0.1 needs dz = 0.5 -> dSIR = 0.2
    d = hc.required_value_change(1.0, 0.0, 1.5, 0.6, 0.4, 0.2, 0.1)
    assert d == pytest.approx(0.2)


def test_required_value_change_above_cap_must_first_reach_cap():
    # value 3.0 is above cap 1.5: needs 1.5 just to reach the cap, plus 0.2
    d = hc.required_value_change(3.0, 0.0, 1.5, 0.6, 0.4, 0.2, 0.1)
    assert d == pytest.approx(1.7)


def test_required_value_change_infeasible_at_floor():
    # w = 0.3, dz needed = 0.5/0.2*... -> target 0.3 - (0.5/0.2)*0.4 = -0.7 < floor 0
    assert hc.required_value_change(0.3, 0.0, 1.5, 0.6, 0.4, 0.2, 0.5) is None


def test_required_value_change_edge_cases():
    assert hc.required_value_change(None, 0, 1.5, 0.6, 0.4, 0.2, 0.1) is None
    assert hc.required_value_change(1.0, 0, 1.5, 0.6, 0.4, 0.0, 0.1) is None  # no weight
    assert hc.required_value_change(1.0, 0, 1.5, 0.6, 0.4, 0.2, -0.1) == 0.0  # already clear
    # exactly reaching the floor is feasible
    assert hc.required_value_change(0.4, 0.0, 1.5, 0.6, 0.4, 0.2, 0.2) == pytest.approx(0.4)


def test_required_value_increase_mirror():
    assert hc.required_value_increase(1.0, 0.0, 1.5, 0.6, 0.4, 0.2, 0.1) == pytest.approx(0.2)
    # below floor: must rise to the floor first
    assert hc.required_value_increase(-0.0, 0.2, 1.5, 0.6, 0.4, 0.2, 0.1) == pytest.approx(0.4)
    # cap makes it infeasible
    assert hc.required_value_increase(1.4, 0.0, 1.5, 0.6, 0.4, 0.2, 0.1) is None


def test_required_change_roundtrip_moves_total_exactly():
    p = {"winsor_low": 0.0, "winsor_high": 1.5, "mean": 0.6, "sd": 0.4}
    z = {"cauti": hc.measure_z(1.2, p), "clabsi": 0.3, "psi90": -0.2}
    t0, w = hc.total_score(z)
    d = hc.required_value_change(1.2, p["winsor_low"], p["winsor_high"], p["mean"], p["sd"], w["cauti"], 0.05)
    t1, _ = hc.total_score({**z, "cauti": hc.measure_z(1.2 - d, p)})
    assert t0 - t1 == pytest.approx(0.05)


@pytest.mark.parametrize("dsir,pred,expected", [(0.2, 15.0, 3), (0.2, 14.9, 3), (0.1, 30.0, 3), (0.0, 10, 0), (0.2, None, None), (0.2, 0, None)])
def test_events_from_sir_change(dsir, pred, expected):
    assert hc.events_from_sir_change(dsir, pred) == expected


def test_events_rounding_guard():
    # 0.28 * 25 = 7.000000000000001 in floats; must stay 7, not 8
    assert 0.28 * 25 > 7 and hc.events_from_sir_change(0.28, 25.0) == 7
    assert math.isclose(hc.events_from_sir_change(0.21, 10.0), 3)
