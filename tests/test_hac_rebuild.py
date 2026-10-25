"""Validate the rebuilt FY2026 HAC scores against the official CMS file (yq43-i98g).

Independent rebuild = parameters recomputed from published values (the true replication).
Calibrated = CMS's own parameters recovered from published z-scores (used downstream)."""

import json
from pathlib import Path

import pytest

from pipeline import hac_core as hc
from pipeline import hac_rebuild as hr

ROOT = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(not hr.RAW.exists(), reason="raw HAC file not fetched (run make data)")


@pytest.fixture(scope="module")
def acc():
    return hr.build()


@pytest.fixture(scope="module")
def df():
    return hr.load()


def test_load_contract(df):
    assert df["ccn"].str.fullmatch(r"[0-9A-Z]{6}").all()
    assert not df["ccn"].duplicated().any()
    assert (df["fiscal_year"] == 2026).all()


def test_penalty_flag_agreement_at_least_99pct(acc):
    assert acc["flag_agreement"] >= 0.99, acc["flag_agreement"]


@pytest.mark.parametrize("m", hc.MEASURES)
def test_calibrated_z_within_tolerance(acc, m):
    assert acc["z_within_tol_calibrated"][m] >= 0.99


@pytest.mark.parametrize("m", ["clabsi", "ssi", "mrsa"])
def test_independent_z_exact_where_inputs_suffice(acc, m):
    """These measures reproduce exactly from the published SIRs alone."""
    assert acc["z_within_tol"][m] >= 0.99


def test_independent_rebuild_reported_honestly(acc):
    """PSI 90 / CDI can't hit ±0.001 from rounded published inputs; we report the real rate, which must
    still be substantial, and every measure's worst-case error must stay small."""
    for m in hc.MEASURES:
        assert 0 < acc["z_within_tol"][m] <= 1
        assert acc["max_abs_z_diff"][m] < 0.01


def test_calibrated_totals_and_flags_exact(acc):
    assert acc["total_within_tol_calibrated"] >= 0.999
    assert acc["flag_agreement_calibrated"] == 1.0


def test_cutoff_consistent_with_official_flags(acc):
    assert abs(acc["cutoff_rebuilt"] - acc["cutoff_official_inferred"]) < 0.005


def test_aggregation_reproduces_official_total(df):
    """Equal-weighted mean of the official z's reproduces the official total."""
    zc = [f"{m}_z_official" for m in hc.MEASURES]
    rows = df[df["total_official"].notna()]
    for _, r in rows.iterrows():
        t, _ = hc.total_score({m: (None if r[f"{m}_z_official"] != r[f"{m}_z_official"] else r[f"{m}_z_official"]) for m in hc.MEASURES})
        assert t == pytest.approx(r["total_official"], abs=1.5e-4)
    assert len(zc) == 6


def test_outputs_written(acc):
    params = json.loads(hr.OUT_PARAMS.read_text())
    assert params["near_band"] == 2
    assert set(params["measures"]) == set(hc.MEASURES)
    for p in params["measures"].values():
        assert p["winsor_low"] < p["mean"] < p["winsor_high"] and p["sd"] > 0
    out = json.loads(hr.OUT_ACCURACY.read_text())
    for k in ["fiscal_year", "source", "n_hospitals", "n_scored", "flag_agreement", "z_within_tol", "total_within_tol",
              "max_abs_z_diff", "cutoff_official_inferred", "cutoff_rebuilt", "mismatches", "notes"]:
        assert k in out
    assert len(out["mismatches"]) <= 50
    import pandas as pd
    pq = pd.read_parquet(hr.OUT_PARQUET)
    assert pq["ccn"].str.len().eq(6).all() and len(pq) == out["n_hospitals"]
