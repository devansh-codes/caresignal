"""Status rules, peer grouping and percentile helpers."""

import numpy as np
import pandas as pd

from pipeline.metrics import assign_peer_groups, classify_status, load_peer_rules, pct_rank, teaching_status


def test_status_rules():
    assert classify_status(True, -0.01, None, 2) == "penalized"  # official flag wins
    assert classify_status(False, 0.05, None, 2) == "clear"
    assert classify_status(None, 0.05, None, 2) == "penalized"  # suppressed flag -> gap
    assert classify_status(False, -0.1, 2, 2) == "near"
    assert classify_status(False, -0.1, 3, 2) == "clear"
    assert classify_status(None, None, None, 2) == "no_score"
    # Maryland: scored but waived, whatever the gap or flag
    assert classify_status(None, 0.5, None, 2, is_maryland=True) == "exempt"
    assert classify_status(None, -0.5, 1, 2, is_maryland=True) == "exempt"
    assert classify_status(None, None, None, 2, is_maryland=True) == "no_score"


def test_teaching_thresholds():
    r = load_peer_rules()
    assert teaching_status(0, 200, r) == "none"
    assert teaching_status(10, 200, r) == "minor"
    assert teaching_status(50, 200, r) == "major"
    assert teaching_status(5, None, r) is None


def test_peer_fallback_when_group_small():
    r = load_peer_rules()
    rows = []
    # 20 urban-south 150-bed non-teaching hospitals (full group survives) + 3 rural-west (falls back)
    for i in range(20):
        rows.append({"ccn": f"{i:06d}", "beds": 150, "resident_fte": 0, "urban_rural": "urban", "state": "TX"})
    for i in range(20, 23):
        rows.append({"ccn": f"{i:06d}", "beds": 150, "resident_fte": 0, "urban_rural": "rural", "state": "OR"})
    rows.append({"ccn": "999999", "beds": None, "resident_fte": None, "urban_rural": None, "state": "TX"})
    h = pd.DataFrame(rows)
    out = assign_peer_groups(h, set(h["ccn"]), r).set_index("ccn")
    assert out.at["000000", "peer_key"] == "b100_299-none-urban-south"
    assert not out.at["000000", "peer_fallback"]
    assert out.at["000021", "peer_key"] == "b100_299-none"
    assert out.at["000021", "peer_fallback"]
    assert out.at["999999", "peer_key"] is None


def test_pct_rank_midrank():
    a = np.array([1.0, 2.0, 3.0, 4.0, np.nan])
    assert pct_rank(a, 2.0) == 37.5
    assert pct_rank(a, None) is None
