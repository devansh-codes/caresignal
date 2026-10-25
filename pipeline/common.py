"""Shared pipeline helpers: paths, CCN normalization, date parsing and NA handling.

Other stages import from here, so keep this module small and the signatures stable.
"""

from __future__ import annotations

import math
import re
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config"
DATA = ROOT / "data"
RAW = DATA / "raw"
PROCESSED = DATA / "processed"
SNAPSHOTS = DATA / "snapshots"
SQL_DIR = ROOT / "pipeline" / "sql"
WEB_DATA = ROOT / "web" / "public" / "data"
WEB_DOWNLOADS = ROOT / "web" / "public" / "downloads"

# Text values CMS uses to mean "no value". Footnote columns keep the reason.
NA_STRINGS = frozenset(
    {
        "",
        "N/A",
        "NA",
        "Not Available",
        "Not Applicable",
        "Too Few to Report",
        "--",
    }
)

HAI_KEYS = {
    "HAI_1": "clabsi",
    "HAI_2": "cauti",
    "HAI_3": "ssi_colon",
    "HAI_4": "ssi_hyst",
    "HAI_5": "mrsa",
    "HAI_6": "cdi",
}

CENSUS_REGION = {
    **dict.fromkeys(["CT", "ME", "MA", "NH", "RI", "VT", "NJ", "NY", "PA"], "northeast"),
    **dict.fromkeys(
        ["IL", "IN", "MI", "OH", "WI", "IA", "KS", "MN", "MO", "NE", "ND", "SD"], "midwest"
    ),
    **dict.fromkeys(
        [
            "DE", "DC", "FL", "GA", "MD", "NC", "SC", "VA", "WV",
            "AL", "KY", "MS", "TN", "AR", "LA", "OK", "TX",
        ],
        "south",
    ),
    **dict.fromkeys(
        ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY", "AK", "CA", "HI", "OR", "WA"], "west"
    ),
    **dict.fromkeys(["PR", "GU", "VI", "AS", "MP"], "territory"),
}


def raw_path(dataset_id: str) -> Path:
    return RAW / f"{dataset_id}.csv"


def processed_path(name: str) -> Path:
    return PROCESSED / (name if name.endswith((".parquet", ".json", ".csv")) else f"{name}.parquet")


def norm_ccn(value) -> str | None:
    """Return a 6-character CCN string with leading zeros, or None."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    s = str(value).strip().strip('"').strip("'")
    if not s:
        return None
    if re.fullmatch(r"\d+(\.0+)?", s):
        s = s.split(".")[0]
    return s.zfill(6) if len(s) < 6 else s


def is_na(value) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return str(value).strip() in NA_STRINGS


def to_float(value) -> float | None:
    if is_na(value):
        return None
    try:
        return float(str(value).replace(",", "").replace("%", "").strip())
    except ValueError:
        return None


def parse_date(value) -> str | None:
    """CMS 'MM/DD/YYYY' (or ISO) -> 'YYYY-MM-DD'."""
    if is_na(value):
        return None
    s = str(value).strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def census_region(state: str | None) -> str | None:
    return CENSUS_REGION.get((state or "").strip().upper())


def today_iso() -> str:
    return date.today().isoformat()
