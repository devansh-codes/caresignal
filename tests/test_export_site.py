"""Contract checks on the exported site JSON (skipped until the pipeline has run)."""

import csv
import json
import random

import pytest

from pipeline.common import PROCESSED, RAW, WEB_DATA

pytestmark = [pytest.mark.data, pytest.mark.skipif(not (WEB_DATA / "index.json").exists(), reason="site JSON not exported yet")]

HOSPITAL_KEYS = {"ccn", "name", "address", "city", "state", "zip", "county", "type", "ownership", "emergency",
                 "overall_rating", "peer", "profile", "hac", "trajectory", "hai", "psi", "hcahps", "readmissions", "vbp", "sep1"}
HAC_KEYS = {"fiscal_year", "source", "period", "total", "total_rebuilt", "cutoff", "gap", "status", "payment_reduction",
            "percentile", "measures", "patients_to_prevent", "tipping_measure", "cushion_events", "exposure_usd"}


def _index():
    return json.loads((WEB_DATA / "index.json").read_text())


def test_index_covers_general_info():
    with open(RAW / "xubh-q36u.csv", encoding="utf-8-sig") as f:
        n = sum(1 for _ in csv.DictReader(f))
    idx = _index()
    assert len(idx) == n
    assert len({e["ccn"] for e in idx}) == n
    assert all(len(e["ccn"]) == 6 for e in idx)
    assert {e["status"] for e in idx} <= {"penalized", "near", "clear", "exempt", "no_score"}


def test_every_hospital_file_has_required_keys():
    idx = _index()
    files = {p.stem for p in (WEB_DATA / "hospitals").glob("*.json")}
    assert files == {e["ccn"] for e in idx}
    sample = random.Random(7).sample(idx, 300) + [e for e in idx if e["hac"] is not None][:50]
    for e in sample:
        h = json.loads((WEB_DATA / "hospitals" / f"{e['ccn']}.json").read_text())
        assert HOSPITAL_KEYS <= set(h), e["ccn"]
        if h["hac"] is not None:
            assert HAC_KEYS <= set(h["hac"])
            assert len(h["hac"]["measures"]) == 6
            assert abs(h["hac"]["gap"] - (h["hac"]["total"] - h["hac"]["cutoff"])) < 1e-3


def test_national_and_peer_files():
    nat = json.loads((WEB_DATA / "national.json").read_text())
    assert nat["counts"]["hac_scored"] > 0
    assert sum(nat["hac_histogram"]["counts"]) == nat["counts"]["hac_scored"]
    assert len(nat["hac_histogram"]["bins"]) == len(nat["hac_histogram"]["counts"]) + 1
    for p in list((WEB_DATA / "peers").glob("*.json"))[:20]:
        pf = json.loads(p.read_text())
        assert all(len(v) == len(pf["hospitals"]) for v in pf["values"].values())


def test_site_size_budget():
    size = sum(p.stat().st_size for p in WEB_DATA.rglob("*") if p.is_file())
    assert size < 60e6


@pytest.mark.data
def test_national_counts_consistent():
    nat = json.loads((WEB_DATA / "national.json").read_text())
    c = nat["counts"]
    assert c["penalized"] + c["near"] + c["clear"] + c["exempt"] == c["hac_scored"]
    idx = _index()
    for st in ("penalized", "near", "clear", "exempt"):
        assert sum(e["status"] == st for e in idx) == c[st]
    # every peer key used in the index has a label
    labels = {p["key"] for p in nat["peer_groups"]}
    assert {e["peer"] for e in idx if e["peer"]} <= labels
    # scoring params exported at full precision for simulator parity
    params = json.loads((PROCESSED / "hac_params.json").read_text())
    assert nat["hac_params"]["cutoff"] == params["cutoff"]
    for m, p in params["measures"].items():
        assert nat["hac_params"]["measures"][m]["sd"] == p["sd"]
