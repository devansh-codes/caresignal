"""Transform contract tests: grains, CCN format, NA handling, and spot values vs the raw CSVs.

Spot checks read the raw file at test time instead of hard-coding numbers, so they keep passing
after each weekly CMS refresh.
"""

import csv
import math

import pandas as pd
import pytest

from pipeline.common import PROCESSED, RAW, norm_ccn, parse_date, to_float
from pipeline.transform import OUTPUTS

SPOT_CCNS = ["010001", "050454", "330101"]  # Southeast Health (AL), UCSF (CA), NewYork-Presbyterian (NY)


def load(name: str) -> pd.DataFrame:
    path = PROCESSED / f"{name}.parquet"
    if not path.exists():
        pytest.skip(f"{path.name} not built; run python -m pipeline.transform")
    return pd.read_parquet(path)


def raw_rows(stem: str, where):
    with open(RAW / f"{stem}.csv", newline="", encoding="utf-8-sig") as f:
        return [r for r in csv.DictReader(f) if where(r)]


def same(a, b) -> bool:
    if a is None or (isinstance(a, float) and math.isnan(a)):
        return b is None or (isinstance(b, float) and math.isnan(b))
    return a == b


@pytest.mark.parametrize("table,keys", OUTPUTS.items())
def test_grain_unique(table, keys):
    df = load(table)
    assert len(df) > 0
    assert not df.duplicated(keys).any(), f"{table} has duplicate {keys}"


@pytest.mark.parametrize("table", [t for t in OUTPUTS if t != "hcahps_benchmarks"])
def test_ccn_is_six_char_string(table):
    df = load(table)
    assert df["ccn"].map(lambda s: isinstance(s, str) and len(s) == 6).all()
    assert df["ccn"].notna().all()


def test_no_na_text_in_values():
    hai = load("hai")
    assert pd.api.types.is_float_dtype(hai["sir"])
    hrrp = load("hrrp")
    assert pd.api.types.is_float_dtype(hrrp["err"])
    assert not hrrp["readmissions"].isin(["N/A", ""]).any()
    hosp = load("hospitals")
    assert not hosp["name"].isin(["Not Available", ""]).any()


def test_dates_are_iso():
    for table, col in [("hai", "start_date"), ("hcahps", "end_date"), ("hrrp", "start_date"), ("psi", "end_date")]:
        s = load(table)[col].dropna()
        assert s.str.fullmatch(r"\d{4}-\d{2}-\d{2}").all(), table


def test_hospitals_match_general_info():
    hosp = load("hospitals").set_index("ccn")
    raw = raw_rows("xubh-q36u", lambda r: True)
    assert len(hosp) == len(raw)
    for r in raw:
        if r["Facility ID"] in SPOT_CCNS:
            h = hosp.loc[r["Facility ID"]]
            assert h["name"] == r["Facility Name"]
            assert h["state"] == r["State"]
            rating = r["Hospital overall rating"]
            assert same(None if rating == "Not Available" else int(rating), None if pd.isna(h["overall_rating"]) else int(h["overall_rating"]))


def test_hai_matches_raw():
    hai = load("hai").set_index(["ccn", "hai_id"])
    raw = raw_rows("77hc-ibv8", lambda r: r["Facility ID"] in SPOT_CCNS)
    assert raw
    col = {"SIR": "sir", "NUMERATOR": "observed", "ELIGCASES": "predicted", "DOPC": "device_days"}
    checked = 0
    for r in raw:
        hai_id, _, metric = r["Measure ID"].partition("_")[2].partition("_")
        hai_id = f"HAI_{hai_id}"
        if metric in col:
            got = hai.loc[(r["Facility ID"], hai_id), col[metric]]
            assert same(to_float(r["Score"]), None if pd.isna(got) else float(got)), r["Measure ID"]
            checked += 1
    assert checked >= 12


def test_hrrp_matches_raw():
    hrrp = load("hrrp").set_index(["ccn", "measure_name"])
    for r in raw_rows("9n3s-kdb3", lambda r: r["Facility ID"] in SPOT_CCNS):
        got = hrrp.loc[(r["Facility ID"], r["Measure Name"])]
        assert same(to_float(r["Excess Readmission Ratio"]), None if pd.isna(got["err"]) else float(got["err"]))
        assert got["start_date"] == parse_date(r["Start Date"])


def test_hcahps_nurse_comm_matches_raw():
    hc = load("hcahps").set_index(["ccn", "measure_id"])
    rows = raw_rows("dgck-syfz", lambda r: r["Facility ID"] in SPOT_CCNS and r["HCAHPS Measure ID"] == "H_COMP_1_A_P")
    assert rows
    for r in rows:
        got = hc.loc[(r["Facility ID"], "H_COMP_1_A_P"), "answer_pct"]
        assert same(to_float(r["HCAHPS Answer Percent"]), None if pd.isna(got) else float(got))


def test_cost_report_join_and_geography():
    hosp = load("hospitals")
    acute = hosp[hosp["hospital_type"] == "Acute Care Hospitals"]
    assert acute["beds"].notna().mean() > 0.9
    # Geographic urban/rural, not the reclassification flag: big-city academic centers are urban.
    for ccn in ("050454", "330101"):
        row = hosp[hosp["ccn"] == ccn]
        if not row.empty and row["cbsa"].notna().all():
            assert row["urban_rural"].iloc[0] == "urban"
    assert set(hosp["urban_rural"].dropna()) <= {"urban", "rural"}
    assert set(hosp["census_region"].dropna()) <= {"northeast", "midwest", "south", "west", "territory"}


def test_common_helpers():
    assert norm_ccn("10001") == "010001"
    assert norm_ccn(10001.0) == "010001"
    assert norm_ccn("05T123") == "05T123"
    assert parse_date("07/01/2022") == "2022-07-01"
    assert to_float("Not Available") is None
    assert to_float("1,234.5") == 1234.5
