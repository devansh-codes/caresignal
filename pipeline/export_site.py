"""Serialize processed data to the static site's JSON (shapes: web/src/lib/types.ts).

Writes web/public/data/{index,national,manifest,measures}.json, hospitals/{ccn}.json, peers/{key}.json,
and web/public/downloads/*.csv. JSON is compact with floats rounded per field type.
"""

from __future__ import annotations

import json
import math
import pickle
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.common import PROCESSED, RAW, ROOT, WEB_DATA, WEB_DOWNLOADS
from pipeline.metrics import _num, _str, load_measure_map

# Rounding by key name; anything else falls back to 4 dp.
DP = {
    **dict.fromkeys(["sir", "ci_lower", "ci_upper", "predicted", "observed", "device_days"], 3),
    **dict.fromkeys(["percentile", "percentile_national", "percentile_peer", "peer_median", "national", "state",
                     "tps_percentile", "pct", "response_rate", "tps", "clinical", "engagement", "safety", "efficiency"], 1),
    **dict.fromkeys(["exposure_usd", "medicare_payments"], 0),
    # HAC scoring parameters stay at full precision so the browser simulator matches the pipeline exactly
    **dict.fromkeys(["winsor_low", "winsor_high", "mean", "sd", "cutoff"], None),
}
DEFAULT_DP = 4

PEER_METRICS = {
    "hac_total": "hac_total",
    **{f"{m}_value": f"{m}_value" for m in ("psi90", "clabsi", "cauti", "ssi", "cdi", "mrsa")},
    "nurse_comm": "nurse_comm_top_box",
    "discharge_info": "discharge_info_yes",
    "hcahps_star": "hcahps_star",
    "err_hf": "err_hf",
    "err_pn": "err_pn",
    "err_ami": "err_ami",
    "err_copd": "err_copd",
}


def _round(obj, key=None):
    if isinstance(obj, dict):
        return {k: _round(v, k) for k, v in obj.items()}
    if isinstance(obj, list | tuple):
        return [_round(v, key) for v in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, float | np.floating):
        f = float(obj)
        if math.isnan(f) or math.isinf(f):
            return None
        d = DP.get(key, DEFAULT_DP)
        if d is None:
            return f
        r = round(f, d)
        return int(r) if d == 0 else r
    if obj is pd.NA or obj is pd.NaT:
        return None
    return obj


def write_json(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    s = json.dumps(_round(obj), separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    path.write_text(s)
    return len(s)


def _bool(v):
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(v, str):
        return {"y": True, "yes": True, "true": True, "n": False, "no": False, "false": False}.get(v.strip().lower())
    return bool(v)


def _int(v):
    n = _num(v)
    return None if n is None else int(round(n))


def git_sha() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short=7", "HEAD"], cwd=ROOT, stderr=subprocess.DEVNULL).decode().strip()
    except Exception:  # noqa: BLE001 - no repo/commit yet
        return None


def build_manifest() -> dict:
    """Normalize data/raw/manifest.json (fetch stage) to the Manifest type."""
    src = RAW / "manifest.json"
    raw = json.loads(src.read_text()) if src.exists() else {}
    entries = raw.get("sources", raw.get("datasets", raw if isinstance(raw, list) else []))
    if isinstance(entries, dict):
        entries = [{"id": k, **v} for k, v in entries.items()]
    sources = []
    for e in entries:
        period = e.get("period")
        if period is None and (e.get("period_start") or e.get("period_end")):
            period = {"start": e.get("period_start"), "end": e.get("period_end")}
        sources.append({
            "id": e.get("id") or e.get("dataset_id"),
            "title": e.get("title", ""),
            "role": e.get("role", ""),
            "modified": e.get("modified"),
            "download_url": e.get("download_url") or e.get("downloadURL") or "",
            "rows": int(e.get("rows") or 0),
            "period": period,
            "http_status": int(e.get("http_status") or 0),
            "sha256": e.get("sha256", ""),
            "fetched_at": e.get("fetched_at", ""),
        })
    return {"built_at": datetime.now(UTC).isoformat(timespec="seconds"), "git_sha": git_sha(), "sources": sources}


def main() -> None:
    hm = pd.read_parquet(PROCESSED / "hospital_metrics.parquet")
    hm["ccn"] = hm["ccn"].astype(str).str.zfill(6)
    hosp = pd.read_parquet(PROCESSED / "hospitals.parquet")
    hosp["ccn"] = hosp["ccn"].astype(str).str.zfill(6)
    hosp = hosp.drop_duplicates("ccn").set_index("ccn")
    with open(PROCESSED / "hospital_detail.pkl", "rb") as f:
        detail = pickle.load(f)
    national = json.loads((PROCESSED / "national.json").read_text())
    peer_groups = pd.read_parquet(PROCESSED / "peer_groups.parquet")
    pg = peer_groups.set_index("key")

    # fresh output dirs for sharded files (stale CCNs must not linger)
    for sub in ("hospitals", "peers"):
        shutil.rmtree(WEB_DATA / sub, ignore_errors=True)
    WEB_DATA.mkdir(parents=True, exist_ok=True)

    index = []
    for r in hm.to_dict("records"):
        ccn = r["ccn"]
        h = hosp.loc[ccn]
        d = detail[ccn]
        pk = _str(r.get("peer_key"))
        peer = None
        if pk:
            peer = {
                "key": pk, "label": _str(r.get("peer_label")), "n": int(pg.at[pk, "n"]) if pk in pg.index else 0,
                "fallback": bool(_bool(r.get("peer_fallback"))), "bed_band": _str(r.get("bed_band")),
                "teaching": _str(r.get("teaching")), "urban_rural": _str(r.get("urban_rural")), "region": _str(r.get("region")),
            }
        hospital = {
            "ccn": ccn, "name": _str(h.get("name")) or "", "address": _str(h.get("address")) or "",
            "city": _str(h.get("city")) or "", "state": _str(h.get("state")) or "", "zip": _str(h.get("zip")) or "",
            "county": _str(h.get("county")) or "", "type": _str(h.get("hospital_type")) or "",
            "ownership": _str(h.get("ownership")) or "", "emergency": _bool(h.get("emergency_services")),
            "overall_rating": _int(h.get("overall_rating")),
            "peer": peer,
            "profile": {
                "beds": _num(h.get("beds")), "resident_fte": _num(h.get("resident_fte")),
                "medicare_payments": _num(h.get("medicare_payments")), "medicare_discharges": _num(h.get("medicare_discharges")),
                "cost_report_year": _int(h.get("cost_report_year")),
            },
            "hac": d["hac"], "trajectory": d["trajectory"], "hai": d["hai"], "psi": d["psi"],
            "hcahps": d.get("hcahps"), "readmissions": d.get("readmissions"), "vbp": d.get("vbp"), "sep1": d.get("sep1"),
        }
        write_json(WEB_DATA / "hospitals" / f"{ccn}.json", hospital)

        tip = None
        if _str(r.get("tipping_measure")) and _num(r.get("tipping_events")) is not None:
            tip = {"measure": r["tipping_measure"], "events": int(r["tipping_events"])}
        index.append({
            "ccn": ccn, "name": hospital["name"], "city": hospital["city"], "state": hospital["state"],
            "type": hospital["type"], "hac": _num(r.get("hac_total")), "status": r.get("hac_status") or "no_score",
            "gap": _num(r.get("hac_gap")), "tip": tip, "peer": pk,
        })
    index.sort(key=lambda e: e["name"])
    write_json(WEB_DATA / "index.json", index)

    # peer distribution shards
    for key, g in hm[hm["peer_key"].notna()].groupby("peer_key"):
        values = {mid: [_num(v) for v in g[col]] if col in g.columns else [None] * len(g) for mid, col in PEER_METRICS.items()}
        write_json(WEB_DATA / "peers" / f"{key}.json", {
            "key": key, "label": g["peer_label"].iloc[0], "n": int(len(g)), "hospitals": list(g["ccn"]), "values": values,
        })

    write_json(WEB_DATA / "national.json", national)
    write_json(WEB_DATA / "manifest.json", build_manifest())

    mm = load_measure_map()
    keys = ("id", "label", "program", "category", "rationale", "direction", "source")
    write_json(WEB_DATA / "measures.json", {
        "measures": [{k: (m.get(k) or "").strip() if isinstance(m.get(k), str) else m.get(k) for k in keys} for m in mm["measures"]],
        "footnotes": {str(k): v for k, v in mm["footnotes"].items()},
    })

    # dq.json / accuracy.json are written by their stages; copy from processed if they only exist there
    for name in ("dq.json", "accuracy.json"):
        if not (WEB_DATA / name).exists() and (PROCESSED / name).exists():
            shutil.copy(PROCESSED / name, WEB_DATA / name)

    # downloads
    WEB_DOWNLOADS.mkdir(parents=True, exist_ok=True)
    hm.to_csv(WEB_DOWNLOADS / "caresignal_hospital_metrics.csv", index=False)
    peer_groups.to_csv(WEB_DOWNLOADS / "caresignal_peer_groups.csv", index=False)
    if (PROCESSED / "dq_log.csv").exists():
        shutil.copy(PROCESSED / "dq_log.csv", WEB_DOWNLOADS / "dq_log.csv")

    size = sum(p.stat().st_size for p in WEB_DATA.rglob("*") if p.is_file())
    n_h = len(list((WEB_DATA / "hospitals").glob("*.json")))
    print(f"export_site: {len(index)} index entries, {n_h} hospital files, "
          f"{len(list((WEB_DATA / 'peers').glob('*.json')))} peer files; web/public/data = {size / 1e6:.1f} MB")
    if size > 60e6:
        raise SystemExit(f"site data {size / 1e6:.1f} MB exceeds the 60 MB budget")


if __name__ == "__main__":
    main()
