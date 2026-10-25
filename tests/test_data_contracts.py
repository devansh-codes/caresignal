"""Data contracts on the real raw files (skipped when data/raw has not been fetched)."""
import json
import re
from pathlib import Path

import pandas as pd
import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
DATASETS = yaml.safe_load((ROOT / "config" / "datasets.yaml").read_text())["datasets"]
CCN = re.compile(r"^[0-9A-Z]{6}$")
pytestmark = pytest.mark.data


def raw(ds_id: str, usecols=None) -> pd.DataFrame:
    ds = next(d for d in DATASETS if d["id"] == ds_id)
    p = RAW / ds["file"]
    if not p.exists():
        pytest.skip(f"{p} not fetched")
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return pd.read_csv(p, dtype=str, keep_default_na=False, encoding=enc, usecols=usecols)
        except UnicodeDecodeError:
            continue


def test_registry_has_all_sources():
    ids = {d["id"] for d in DATASETS}
    assert {"xubh-q36u", "77hc-ibv8", "dgck-syfz", "ynj2-r877", "muwa-iene", "yq43-i98g", "9n3s-kdb3",
            "ypbt-wvdk", "632h-zaca", "yv7e-xc69", "99ue-w85f", "84jm-wiui", "cost_report",
            "medicare_inpatient"} <= ids
    for d in DATASETS:
        assert d["source"] in {"pdc", "datacms"}
        assert d["expected_columns"], d["id"]


@pytest.mark.parametrize("ds", DATASETS, ids=lambda d: d["id"])
def test_required_columns_present(ds):
    p = RAW / ds["file"]
    if not p.exists():
        pytest.skip("not fetched")
    cols = list(raw(ds["id"]).columns) if p.stat().st_size < 5e6 else list(
        pd.read_csv(p, nrows=0, encoding="latin-1").columns.str.lstrip("﻿"))
    missing = [c for c in ds["expected_columns"] if c not in cols]
    assert not missing, f"{ds['id']} missing {missing}"


@pytest.mark.parametrize("ds", [d for d in DATASETS if d.get("ccn_column")], ids=lambda d: d["id"])
def test_ccn_is_six_char_text(ds):
    s = raw(ds["id"], usecols=[ds["ccn_column"]])[ds["ccn_column"]].str.strip()
    bad = s[~s.str.match(CCN)]
    assert bad.empty, f"{ds['id']}: {len(bad)} malformed CCNs e.g. {bad.head(3).tolist()}"
    assert s.str.startswith("0").any(), "leading-zero CCNs (e.g. Alabama 01xxxx) must survive"


@pytest.mark.parametrize("ds_id", ["xubh-q36u", "yq43-i98g", "ypbt-wvdk"])
def test_no_duplicate_ccns(ds_id):
    s = raw(ds_id, usecols=["Facility ID"])["Facility ID"]
    assert not s.duplicated().any()


def test_hai_grain_unique():
    df = raw("77hc-ibv8", usecols=["Facility ID", "Measure ID"])
    assert not df.duplicated().any()


def test_hac_flag_values():
    df = raw("yq43-i98g", usecols=["Payment Reduction", "State"])
    assert set(df["Payment Reduction"]) <= {"Yes", "No", "N/A", ""}
    # Maryland is the only state with an N/A payment flag (waiver)
    assert set(df.loc[df["Payment Reduction"] == "N/A", "State"]) <= {"MD"}


def test_manifest_shape():
    p = RAW / "manifest.json"
    if not p.exists():
        pytest.skip("manifest not built")
    m = json.loads(p.read_text())
    assert {"built_at", "git_sha", "sources"} <= m.keys()
    ids = {s["id"] for s in m["sources"]}
    assert {d["id"] for d in DATASETS} <= ids
    for s in m["sources"]:
        assert re.fullmatch(r"[0-9a-f]{64}", s["sha256"])
        assert s["rows"] > 0
        assert s["period"] is None or set(s["period"]) == {"start", "end"}
        for k in ("start", "end"):
            v = (s["period"] or {}).get(k)
            assert v is None or re.fullmatch(r"\d{4}-\d{2}-\d{2}", v)
