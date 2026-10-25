"""Hospital-level metrics: peer groups, patients-to-prevent, percentiles and national insights.

Plan §4.2–4.6 and §9. Reads the processed tables (transform) and HAC rebuild outputs (hac_rebuild);
writes data/processed/{hospital_metrics.parquet, peer_groups.parquet, national.json} plus
data/processed/hospital_detail.pkl, the nested per-hospital blocks that export_site.py serializes.

Every number traces to a CMS file and period; nothing here is hard-coded except the methodology.
"""

from __future__ import annotations

import json
import math
import pickle
from datetime import UTC, datetime

import numpy as np
import pandas as pd
import yaml

from pipeline import hac_core
from pipeline.common import CONFIG, PROCESSED

MEASURES = hac_core.MEASURES  # psi90, clabsi, cauti, ssi, cdi, mrsa
HAI_MEASURES = hac_core.HAI_MEASURES
HAC_LABELS = {
    "psi90": "PSI 90 Patient Safety",
    "clabsi": "CLABSI",
    "cauti": "CAUTI",
    "ssi": "SSI (colon + hysterectomy)",
    "cdi": "C. difficile (CDI)",
    "mrsa": "MRSA bacteremia",
}
# Fixed order used to break ties when two measures need the same number of events.
TIE_ORDER = {m: i for i, m in enumerate(["cauti", "clabsi", "cdi", "mrsa", "ssi", "psi90"])}

HAI_LABELS = {
    "clabsi": "CLABSI",
    "cauti": "CAUTI",
    "ssi_colon": "SSI – colon surgery",
    "ssi_hyst": "SSI – abdominal hysterectomy",
    "mrsa": "MRSA bacteremia",
    "cdi": "C. difficile",
}
HAI_IDS = {"clabsi": "HAI_1", "cauti": "HAI_2", "ssi_colon": "HAI_3", "ssi_hyst": "HAI_4", "mrsa": "HAI_5", "cdi": "HAI_6"}

PSI_IDS = ["PSI_03", "PSI_06", "PSI_08", "PSI_09", "PSI_10", "PSI_11", "PSI_12", "PSI_13", "PSI_14", "PSI_15", "PSI_90"]
HCAHPS_ITEMS = [
    "H_COMP_1_A_P",
    "H_NURSE_RESPECT_A_P",
    "H_NURSE_LISTEN_A_P",
    "H_NURSE_EXPLAIN_A_P",
    "H_COMP_6_Y_P",
    "H_DISCH_HELP_Y_P",
    "H_SYMPTOMS_Y_P",
    "H_COMP_5_A_P",
    "H_COMP_2_A_P",
    "H_QUIET_HSP_A_P",
    "H_CLEAN_HSP_A_P",
    "H_HSP_RATING_9_10",
    "H_RECMND_DY",
]
HRRP_CONDITIONS = ["AMI", "HF", "PN", "COPD", "CABG", "HIP-KNEE"]
HRRP_LABELS = {
    "AMI": "Heart attack (AMI)",
    "HF": "Heart failure",
    "PN": "Pneumonia",
    "COPD": "COPD",
    "CABG": "Coronary artery bypass graft (CABG)",
    "HIP-KNEE": "Elective hip/knee replacement",
}

NOT_SUBMITTED_REASON = (
    "No submitted data: CMS assigned the maximum z-score (footnote 18), so reporting data is the lever"
)
PTP_PROXY_NOTE = (
    "Predicted infections are taken from the current HAI file (proxy); the FY2026 HAC file publishes SIRs only."
)


# --------------------------------------------------------------------------------------------- utils
def _num(v):
    """float or None (NaN/NA -> None)."""
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _str(v):
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    s = str(v).strip()
    return s or None


def _date(v):
    """ISO date string or None."""
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(v, str):
        if len(v) == 10 and v[4] == "-":
            return v
        try:
            return datetime.strptime(v, "%m/%d/%Y").date().isoformat()
        except ValueError:
            return v
    return pd.Timestamp(v).date().isoformat()


def _period(start, end):
    s, e = _date(start), _date(end)
    if s is None and e is None:
        return None
    return {"start": s, "end": e}


def pct_rank(values: np.ndarray, x: float | None) -> float | None:
    """Mid-rank percentile (0-100) of x among values: share below plus half the ties.
    Orientation follows the metric (for the Total HAC Score a higher percentile is worse)."""
    if x is None:
        return None
    a = np.asarray(values, dtype=float)
    a = a[~np.isnan(a)]
    if a.size == 0:
        return None
    below = np.sum(a < x)
    equal = np.sum(a == x)
    return float((below + 0.5 * equal) / a.size * 100)


def load_measure_map() -> dict:
    with open(CONFIG / "measure_map.yaml") as f:
        return yaml.safe_load(f)


def load_peer_rules() -> dict:
    with open(CONFIG / "peer_rules.yaml") as f:
        return yaml.safe_load(f)


# --------------------------------------------------------------------------------------- peer groups
def bed_band(beds, rules) -> str | None:
    b = _num(beds)
    if b is None or b <= 0:
        return None
    for key, _label, lo, hi in rules["bed_bands"]:
        if b >= lo and (hi is None or b <= hi):
            return key
    return None


def teaching_status(resident_fte, beds, rules) -> str | None:
    b, r = _num(beds), _num(resident_fte)
    if b is None or b <= 0:
        return None
    r = r or 0.0
    ratio = r / b
    if ratio <= 0:
        return "none"
    return "major" if ratio >= rules["teaching"]["major_min_ratio"] else "minor"


def region_of(state, rules) -> str | None:
    for reg, states in rules["census_regions"].items():
        if state in states:
            return reg
    return None


def peer_label(bed, teach, loc, region, rules) -> str:
    bed_lbl = {k: lbl for k, lbl, _, _ in rules["bed_bands"]}
    parts = [bed_lbl.get(bed, bed), rules["teaching_labels"].get(teach, teach)]
    if loc is not None:
        parts.append(rules["location_labels"].get(loc, loc))
    if region is not None:
        parts.append(rules["region_labels"].get(region, region))
    return " · ".join(parts)


def assign_peer_groups(h: pd.DataFrame, scored: set[str], rules: dict) -> pd.DataFrame:
    """Full key {bed}-{teach}-{loc}-{region}; falls back to {bed}-{teach} when the full group has
    fewer than min_group_size HAC-scored hospitals (or location/region is unknown)."""
    out = pd.DataFrame({"ccn": h["ccn"]})
    out["bed_band"] = [bed_band(b, rules) for b in h["beds"]]
    out["teaching"] = [teaching_status(r, b, rules) for r, b in zip(h["resident_fte"], h["beds"], strict=False)]
    out["urban_rural"] = [_str(u) for u in h["urban_rural"]]
    out["region"] = [region_of(s, rules) for s in h["state"]]
    has_core = out["bed_band"].notna() & out["teaching"].notna()
    full_ok = has_core & out["urban_rural"].notna() & out["region"].notna()
    out["full_key"] = np.where(
        full_ok,
        out["bed_band"].astype(str) + "-" + out["teaching"].astype(str) + "-" + out["urban_rural"].astype(str) + "-" + out["region"].astype(str),
        None,
    )
    out["fb_key"] = np.where(has_core, out["bed_band"].astype(str) + "-" + out["teaching"].astype(str), None)
    is_scored = out["ccn"].isin(scored)
    full_counts = out[is_scored & out["full_key"].notna()].groupby("full_key").size()
    min_n = rules["min_group_size"]
    use_full = out["full_key"].map(lambda k: k is not None and full_counts.get(k, 0) >= min_n)
    out["peer_key"] = np.where(use_full, out["full_key"], out["fb_key"])
    out["peer_fallback"] = np.where(out["peer_key"].notna(), ~use_full, None)
    out["peer_label"] = [
        None if k is None else (
            peer_label(b, t, u, r, rules) if not fb else peer_label(b, t, None, None, rules)
        )
        for k, b, t, u, r, fb in zip(out["peer_key"], out["bed_band"], out["teaching"], out["urban_rural"], out["region"], out["peer_fallback"], strict=False)
    ]
    out["peer_key"] = out["peer_key"].where(out["peer_key"].notna(), None)
    return out.drop(columns=["full_key", "fb_key"])


# ------------------------------------------------------------------------------- patients-to-prevent
def patients_to_prevent(values: dict, weights: dict, predicted: dict, params: dict, gap: float | None) -> list[dict]:
    """Events to prevent in each measure (alone) to bring the Total HAC Score to the cutoff.

    values: raw measure values (SIR / PSI 90 composite); weights: equal weights from total_score;
    predicted: predicted infections per HAI measure; gap = total - cutoff (> 0 means above cutoff).
    """
    rows = []
    for m in MEASURES:
        v, w = values.get(m), weights.get(m, 0.0)
        p = params[m]
        row = {"measure": m, "events": None, "delta_sir": None, "feasible": False, "reason": None}
        if gap is None:
            row["reason"] = "No Total HAC Score"
        elif v is None and w > 0:
            row["reason"] = NOT_SUBMITTED_REASON
        elif v is None or w <= 0:
            row["reason"] = "No result for this measure"
        elif gap <= 0:
            row.update(events=0, delta_sir=0.0, feasible=True, reason="Already at or below the cutoff")
        else:
            d = hac_core.required_value_change(v, p["winsor_low"], p["winsor_high"], p["mean"], p["sd"], w, gap)
            if d is None:
                row["reason"] = "Winsorization floor: this measure alone cannot close the gap"
            else:
                row["delta_sir"] = d
                if m == "psi90":
                    row["reason"] = "PSI 90 is a composite rate; event counts cannot be derived from public data"
                else:
                    ev = hac_core.events_from_sir_change(d, predicted.get(m))
                    if ev is None:
                        row["reason"] = "No predicted infection count in the current HAI file"
                    else:
                        row.update(events=max(ev, 1), feasible=True)
        rows.append(row)
    return rows


def cushion_events(values: dict, weights: dict, predicted: dict, params: dict, gap: float | None) -> list[dict]:
    """For a hospital at or below the cutoff: added infections in one measure that would push the
    Total HAC Score strictly above the cutoff."""
    rows = []
    for m in HAI_MEASURES:
        v, w = values.get(m), weights.get(m, 0.0)
        p = params[m]
        row = {"measure": m, "events": None, "delta_sir": None, "feasible": False, "reason": None}
        if gap is None or gap > 0:
            row["reason"] = "Not applicable (above cutoff or no score)"
        elif v is None and w > 0:
            row["reason"] = NOT_SUBMITTED_REASON
        elif v is None or w <= 0:
            row["reason"] = "No result for this measure"
        else:
            margin = -gap + 1e-9  # strictly above the cutoff
            d = hac_core.required_value_increase(v, p["winsor_low"], p["winsor_high"], p["mean"], p["sd"], w, margin)
            if d is None:
                row["reason"] = "Winsorization cap: added infections in this measure alone cannot cross the cutoff"
            else:
                ev = hac_core.events_from_sir_change(d, predicted.get(m))
                row["delta_sir"] = d
                if ev is None:
                    row["reason"] = "No predicted infection count in the current HAI file"
                else:
                    row.update(events=max(ev, 1), feasible=True)
        rows.append(row)
    return rows


def tipping(ptp: list[dict]) -> tuple[str | None, int | None]:
    feas = [r for r in ptp if r["feasible"] and r["events"] is not None and r["events"] > 0]
    if not feas:
        return None, None
    best = min(feas, key=lambda r: (r["events"], TIE_ORDER[r["measure"]]))
    return best["measure"], best["events"]


def min_events(rows: list[dict]) -> int | None:
    ev = [r["events"] for r in rows if r["feasible"] and r["events"] is not None]
    return min(ev) if ev else None


def classify_status(payment_reduction, gap, min_cushion, near_band, is_maryland: bool = False) -> str:
    """Contract status rules: no_score without a Total HAC Score; exempt for Maryland (scored, but waived from
    the payment reduction under the All-Payer Model); penalized = official Yes (gap > 0 when the flag is
    suppressed); near = not penalized and the smallest HAI cushion is <= near_band infections; else clear."""
    if gap is None:
        return "no_score"
    if is_maryland:
        return "exempt"
    penalized = bool(payment_reduction) if payment_reduction is not None else gap > 0
    if penalized:
        return "penalized"
    if min_cushion is not None and min_cushion <= near_band:
        return "near"
    return "clear"


# ------------------------------------------------------------------------------------------- loaders
def load_inputs() -> dict:
    t = {}
    for name in ["hospitals", "hai", "psi", "hcahps", "hcahps_benchmarks", "hrrp", "vbp", "timely_care", "hac_rebuild"]:
        t[name] = pd.read_parquet(PROCESSED / f"{name}.parquet")
        if "ccn" in t[name].columns:
            t[name]["ccn"] = t[name]["ccn"].astype(str).str.zfill(6)
    with open(PROCESSED / "hac_params.json") as f:
        t["params"] = json.load(f)
    return t


# ------------------------------------------------------------------------------------------ builders
def build(t: dict) -> dict:
    mm = load_measure_map()
    rules = load_peer_rules()
    cats = {m["id"]: m["category"] for m in mm["measures"]}
    labels = {m["id"]: m["label"] for m in mm["measures"]}
    params = t["params"]
    P = params["measures"]
    cutoff = float(params["cutoff"])
    near_band = int(params.get("near_band", 2))
    fy = int(params.get("fiscal_year", 2026))

    hosp = t["hospitals"].drop_duplicates("ccn").reset_index(drop=True)
    hac = t["hac_rebuild"].drop_duplicates("ccn").set_index("ccn")
    hai = t["hai"]

    # ---------------- current HAI (proxy predicted counts + trajectory values)
    hai_w = {}
    for r in hai.itertuples(index=False):
        hai_w.setdefault(r.ccn, {})[r.key] = r
    hai_period = _period(hai["start_date"].dropna().min() if len(hai) else None, hai["end_date"].dropna().max() if len(hai) else None)

    def hai_pred(ccn):
        d = hai_w.get(ccn, {})
        g = lambda k, f: _num(getattr(d[k], f)) if k in d else None  # noqa: E731
        pred = {m: g(m, "predicted") for m in ("clabsi", "cauti", "cdi", "mrsa")}
        obs = {m: g(m, "observed") for m in ("clabsi", "cauti", "cdi", "mrsa")}
        sir = {m: g(m, "sir") for m in ("clabsi", "cauti", "cdi", "mrsa")}
        p3, p4 = g("ssi_colon", "predicted"), g("ssi_hyst", "predicted")
        o3, o4 = g("ssi_colon", "observed"), g("ssi_hyst", "observed")
        ps = [x for x in (p3, p4) if x is not None]
        pred["ssi"] = sum(ps) if ps else None
        os_ = [o for o, p in ((o3, p3), (o4, p4)) if p is not None and o is not None]
        obs["ssi"] = sum(os_) if os_ else None
        # combined SSI SIR = sum observed / sum predicted over procedures that have a reported SIR
        num = den = 0.0
        for k in ("ssi_colon", "ssi_hyst"):
            if k in d and _num(d[k].sir) is not None and _num(d[k].predicted) and _num(d[k].observed) is not None:
                num += _num(d[k].observed)
                den += _num(d[k].predicted)
        sir["ssi"] = num / den if den > 0 else None
        return pred, obs, sir

    # ---------------- PSI
    psi = t["psi"]
    psi_by = {}
    for r in psi.itertuples(index=False):
        psi_by.setdefault(r.ccn, {})[r.measure_id] = r
    psi90_rows = psi[psi["measure_id"] == "PSI_90"]
    psi_period = _period(psi90_rows["start_date"].dropna().min() if len(psi90_rows) else None, psi90_rows["end_date"].dropna().max() if len(psi90_rows) else None)

    # ---------------- HCAHPS
    hc = t["hcahps"]
    hc_items = hc[hc["measure_id"].isin(HCAHPS_ITEMS)]
    hc_val = hc_items.pivot_table(index="ccn", columns="measure_id", values="answer_pct", aggfunc="first")
    hc_fn = hc_items.pivot_table(index="ccn", columns="measure_id", values="answer_pct_fn", aggfunc="first")
    star_rows = hc[hc["measure_id"] == "H_STAR_RATING"].drop_duplicates("ccn").set_index("ccn")
    hc_meta = hc.drop_duplicates("ccn").set_index("ccn")
    hc_period = _period(hc["start_date"].dropna().min() if len(hc) else None, hc["end_date"].dropna().max() if len(hc) else None)
    bench = t["hcahps_benchmarks"]
    nat = bench[bench["level"].str.upper().isin(["NATION", "NATIONAL"])].set_index("measure_id")["answer_pct"].to_dict()
    st_bench = {(r.level, r.measure_id): _num(r.answer_pct) for r in bench.itertuples(index=False)}

    # ---------------- HRRP / VBP / SEP-1
    hrrp = t["hrrp"]
    hrrp_by = {}
    for r in hrrp.itertuples(index=False):
        hrrp_by.setdefault(r.ccn, {})[r.condition] = r
    hrrp_period = _period(hrrp["start_date"].dropna().min() if len(hrrp) else None, hrrp["end_date"].dropna().max() if len(hrrp) else None)
    vbp = t["vbp"].drop_duplicates("ccn").set_index("ccn")
    vbp_tps = vbp["tps"].astype(float).to_numpy()
    tc = t["timely_care"]
    sep = tc[tc["measure_id"] == "SEP_1"].drop_duplicates("ccn").set_index("ccn")

    # ---------------- peer groups
    scored = set(hac.index[hac["total_official"].notna()])
    peers = assign_peer_groups(hosp, scored, rules).set_index("ccn")
    peer_n = peers["peer_key"].dropna().value_counts().to_dict()

    # ---------------- per-hospital HAC + trajectory
    hac_totals = hac.loc[hac["total_official"].notna(), "total_official"].astype(float).to_numpy()
    recs, detail = [], {}
    for h in hosp.itertuples(index=False):
        ccn = h.ccn
        pred, obs, cur_sir = hai_pred(ccn)
        rec = {"ccn": ccn, "name": h.name, "city": h.city, "state": h.state, "hospital_type": h.hospital_type}
        pr = peers.loc[ccn]
        rec.update(
            peer_key=pr["peer_key"], peer_label=pr["peer_label"], peer_fallback=pr["peer_fallback"],
            bed_band=pr["bed_band"], teaching=pr["teaching"], urban_rural=pr["urban_rural"], region=pr["region"],
            beds=_num(h.beds),
        )
        exposure = None
        if _num(getattr(h, "medicare_payments", None)) is not None:
            exposure = 0.01 * _num(h.medicare_payments)
        rec["exposure_usd"] = exposure

        hac_block = traj_block = None
        if ccn in hac.index and _num(hac.at[ccn, "total_official"]) is not None:
            r = hac.loc[ccn]
            total = float(r["total_official"])
            vals = {m: _num(r[f"{m}_value"]) for m in MEASURES}
            z_off = {m: _num(r[f"{m}_z_official"]) for m in MEASURES}
            _, weights = hac_core.total_score(z_off)
            gap = total - cutoff
            pr_flag = r.get("payment_reduction_official")
            pr_flag = None if pr_flag is None or pd.isna(pr_flag) else bool(pr_flag)
            ptp = patients_to_prevent(vals, weights, pred, P, gap)
            cush = cushion_events(vals, weights, pred, P, gap) if gap <= 0 else None
            tip_m, tip_ev = tipping(ptp) if gap > 0 else (None, None)
            min_cush = min_events(cush) if cush else None
            is_md = bool(r.get("is_maryland")) if not pd.isna(r.get("is_maryland")) else False
            status = classify_status(pr_flag, gap, min_cush, near_band, is_md)
            measures = []
            for m in MEASURES:
                p = P[m]
                measures.append({
                    "key": m, "label": HAC_LABELS[m], "category": cats.get(m, "other"),
                    "value": vals[m], "value_footnote": _str(r.get(f"{m}_value_fn")),
                    "z_official": z_off[m], "z_rebuilt": _num(r.get(f"{m}_z_rebuilt")),
                    "weight": weights[m], "contribution": None if z_off[m] is None else z_off[m] * weights[m],
                    "winsor_low": p["winsor_low"], "winsor_high": p["winsor_high"], "mean": p["mean"], "sd": p["sd"],
                    "predicted": pred.get(m) if m != "psi90" else None,
                    "observed": obs.get(m) if m != "psi90" else None,
                })
            hac_block = {
                "fiscal_year": int(_num(r.get("fiscal_year")) or fy), "source": "yq43-i98g",
                "period": {"psi90": _period(r.get("psi90_start"), r.get("psi90_end")) or {"start": None, "end": None},
                           "hai": _period(r.get("hai_start"), r.get("hai_end")) or {"start": None, "end": None}},
                "total": total, "total_rebuilt": _num(r.get("total_rebuilt")), "cutoff": cutoff, "gap": gap,
                "status": status, "payment_reduction": pr_flag,
                "percentile": pct_rank(hac_totals, total),
                "measures": measures, "patients_to_prevent": ptp, "tipping_measure": tip_m,
                "cushion_events": cush, "exposure_usd": exposure,
            }
            rec.update(
                hac_total=total, hac_cutoff=cutoff, hac_gap=gap, hac_status=status, payment_reduction=pr_flag,
                hac_percentile=hac_block["percentile"], tipping_measure=tip_m, tipping_events=tip_ev,
                min_cushion_events=min_cush,
            )
            for m in MEASURES:
                rec[f"{m}_value"] = vals[m]
                rec[f"{m}_z"] = z_off[m]
                rec[f"{m}_predicted"] = pred.get(m) if m != "psi90" else None
            for row in ptp:
                rec[f"ptp_{row['measure']}_events"] = row["events"] if row["feasible"] and gap > 0 else None

            # ---- current trajectory (proxy): current HAI SIRs + PSI 90 six-digit rate, FY2026 params
            psi90_cur = _num(psi_by.get(ccn, {}).get("PSI_90").rate) if "PSI_90" in psi_by.get(ccn, {}) else None
            tvals = {"psi90": psi90_cur, **{m: cur_sir.get(m) for m in HAI_MEASURES}}
            tz = {m: hac_core.measure_z(tvals[m], P[m]) if tvals[m] is not None else None for m in MEASURES}
            ttotal, tweights = hac_core.total_score(tz)
            tgap = None if ttotal is None else ttotal - cutoff
            tptp = patients_to_prevent(tvals, tweights, pred, P, tgap)
            tcush = cushion_events(tvals, tweights, pred, P, tgap) if tgap is not None and tgap <= 0 else None
            if tgap is None:
                tstatus = "no_score"
            elif is_md:
                tstatus = "exempt"
            else:
                tstatus = "penalized" if tgap > 0 else ("near" if (min_events(tcush) is not None and min_events(tcush) <= near_band) else "clear")
            ttip, _ = tipping(tptp) if tgap is not None and tgap > 0 else (None, None)
            traj_block = {
                "source": "77hc-ibv8", "period": hai_period or {"start": None, "end": None},
                "label": f"Current trajectory (proxy: latest HAI and PSI files scored on the FY{fy} distribution)",
                "measures": [{"key": m, "value": tvals[m], "z": tz[m], "observed": obs.get(m) if m != "psi90" else None,
                              "predicted": pred.get(m) if m != "psi90" else None} for m in MEASURES],
                "total": ttotal, "gap": tgap, "status": tstatus, "patients_to_prevent": tptp, "tipping_measure": ttip,
            }
            rec.update(traj_total=ttotal, traj_gap=tgap, traj_status=tstatus)
        else:
            rec.update(hac_status="no_score")

        # ---- HAI rows (current file)
        hai_rows = []
        for k in HAI_LABELS:
            d = hai_w.get(ccn, {}).get(k)
            if d is None:
                continue
            hai_rows.append({
                "key": k, "label": HAI_LABELS[k], "category": cats.get(HAI_IDS[k], "other"),
                "sir": _num(d.sir), "ci_lower": _num(d.ci_lower), "ci_upper": _num(d.ci_upper),
                "observed": _num(d.observed), "predicted": _num(d.predicted), "device_days": _num(d.device_days),
                "compared_to_national": _str(d.compared_to_national), "footnote": _str(d.sir_fn),
            })
        # ---- PSI rows
        psi_rows = []
        for pid in PSI_IDS:
            d = psi_by.get(ccn, {}).get(pid)
            if d is None:
                continue
            psi_rows.append({
                "id": pid, "label": labels.get(pid, pid), "category": cats.get(pid, "other"),
                "rate": _num(d.rate), "compared_to_national": _str(getattr(d, "compared_to_national", None)),
                "footnote": _str(getattr(d, "rate_fn", None)),
            })
        detail[ccn] = {
            "hac": hac_block, "trajectory": traj_block,
            "hai": {"source": "77hc-ibv8", "period": hai_period, "rows": hai_rows} if hai_rows else None,
            "psi": {"source": "muwa-iene", "period": psi_period, "rows": psi_rows} if psi_rows else None,
        }
        recs.append(rec)

    hm = pd.DataFrame(recs)

    # ---------------- HCAHPS (percentiles need the whole population, so second pass)
    peer_of = hm.set_index("ccn")["peer_key"].to_dict()
    hc_all = hc_val.reindex(hm["ccn"])
    for ccn in hm["ccn"]:
        if ccn not in hc_val.index:
            detail[ccn]["hcahps"] = None
            continue
        st = hm.loc[hm["ccn"] == ccn, "state"].iloc[0]
        pk = peer_of.get(ccn)
        peer_ccns = hm.loc[hm["peer_key"] == pk, "ccn"] if pk else pd.Series([], dtype=str)
        items = []
        for mid in HCAHPS_ITEMS:
            v = _num(hc_val.at[ccn, mid]) if mid in hc_val.columns else None
            col = hc_val[mid].astype(float).to_numpy() if mid in hc_val.columns else np.array([])
            peer_vals = hc_all.loc[hc_all.index.isin(peer_ccns), mid].astype(float).to_numpy() if mid in hc_val.columns and pk else np.array([])
            peer_vals_clean = peer_vals[~np.isnan(peer_vals)] if peer_vals.size else peer_vals
            items.append({
                "id": mid, "label": labels.get(mid, mid), "category": cats.get(mid, "other"),
                "value": v,
                "peer_median": float(np.median(peer_vals_clean)) if peer_vals_clean.size else None,
                "state": st_bench.get((st, mid)),
                "national": _num(nat.get(mid)),
                "percentile_national": pct_rank(col, v) if v is not None else None,
                "percentile_peer": pct_rank(peer_vals, v) if v is not None and peer_vals_clean.size else None,
                "footnote": _str(hc_fn.at[ccn, mid]) if mid in hc_fn.columns and ccn in hc_fn.index else None,
            })
        meta = hc_meta.loc[ccn]
        star = _num(star_rows.at[ccn, "star_rating"]) if ccn in star_rows.index else None
        detail[ccn]["hcahps"] = {
            "source": "dgck-syfz", "period": hc_period,
            "surveys": _num(meta.get("completed_surveys")), "response_rate": _num(meta.get("response_rate")),
            "star": star, "items": items,
        }
    nc = hc_all["H_COMP_1_A_P"].astype(float) if "H_COMP_1_A_P" in hc_all.columns else pd.Series(np.nan, index=hm["ccn"])
    hm["nurse_comm_top_box"] = nc.to_numpy()
    nc_arr = nc.to_numpy()
    hm["nurse_comm_pctl_nat"] = [pct_rank(nc_arr, _num(v)) for v in nc_arr]
    hm["nurse_comm_pctl_peer"] = [
        pct_rank(hm.loc[hm["peer_key"] == pk, "nurse_comm_top_box"].astype(float).to_numpy(), _num(v)) if pk else None
        for pk, v in zip(hm["peer_key"], nc_arr, strict=False)
    ]
    hm["discharge_info_yes"] = hc_all["H_COMP_6_Y_P"].astype(float).to_numpy() if "H_COMP_6_Y_P" in hc_all.columns else np.nan
    hm["care_transition"] = None  # H_COMP_7 retired in the 2025 HCAHPS survey update
    hm["hcahps_star"] = [(_num(star_rows.at[c, "star_rating"]) if c in star_rows.index else None) for c in hm["ccn"]]

    # ---------------- HRRP
    for cond in HRRP_CONDITIONS:
        col = "err_" + cond.lower().replace("-", "_")
        hm[col] = [_num(hrrp_by[c][cond].err) if c in hrrp_by and cond in hrrp_by[c] else None for c in hm["ccn"]]
    hm["n_err_above_1"] = hm[[f"err_{c.lower().replace('-', '_')}" for c in HRRP_CONDITIONS]].astype(float).gt(1).sum(axis=1)
    for ccn in hm["ccn"]:
        rows = []
        for cond in HRRP_CONDITIONS:
            d = hrrp_by.get(ccn, {}).get(cond)
            if d is None:
                continue
            rows.append({
                "condition": cond, "label": HRRP_LABELS[cond], "err": _num(d.err), "discharges": _num(d.discharges),
                "readmissions": _str(d.readmissions), "predicted_rate": _num(d.predicted_rate),
                "expected_rate": _num(d.expected_rate), "footnote": _str(d.footnote),
            })
        detail[ccn]["readmissions"] = {"source": "9n3s-kdb3", "period": hrrp_period, "rows": rows} if rows else None

        # ---- VBP
        if ccn in vbp.index:
            v = vbp.loc[ccn]
            tps = _num(v["tps"])
            detail[ccn]["vbp"] = {
                "source": "ypbt-wvdk", "fiscal_year": int(_num(v.get("fiscal_year")) or fy), "tps": tps,
                "tps_percentile": pct_rank(vbp_tps, tps) if tps is not None else None,
                "domains": {"clinical": _num(v.get("clinical_w")), "engagement": _num(v.get("engagement_w")),
                            "safety": _num(v.get("safety_w")), "efficiency": _num(v.get("efficiency_w"))},
            }
        else:
            detail[ccn]["vbp"] = None
        # ---- SEP-1
        if ccn in sep.index:
            s = sep.loc[ccn]
            detail[ccn]["sep1"] = {"source": "yv7e-xc69", "period": _period(s.get("start_date"), s.get("end_date")),
                                   "score": _num(s.get("score")), "footnote": _str(s.get("footnote"))}
        else:
            detail[ccn]["sep1"] = None
    hm["vbp_tps"] = [(_num(vbp.at[c, "tps"]) if c in vbp.index else None) for c in hm["ccn"]]

    # make sure every contract column exists
    for m in MEASURES:
        for c in (f"{m}_value", f"{m}_z", f"{m}_predicted", f"ptp_{m}_events"):
            if c not in hm.columns:
                hm[c] = None
    for c in ("hac_total", "hac_cutoff", "hac_gap", "payment_reduction", "hac_percentile", "tipping_measure",
              "tipping_events", "min_cushion_events", "traj_total", "traj_gap", "traj_status"):
        if c not in hm.columns:
            hm[c] = None

    # ---------------- peer groups table
    pg = (hm[hm["peer_key"].notna()].groupby("peer_key")
          .agg(label=("peer_label", "first"), n=("ccn", "size"), fallback=("peer_fallback", "first"),
               n_scored=("hac_total", lambda s: int(s.notna().sum())))
          .reset_index().rename(columns={"peer_key": "key"}))
    hm["peer_n"] = hm["peer_key"].map(pg.set_index("key")["n"]) if len(pg) else None

    national = build_national(hm, detail, t, params, nat, hc_period, hai_period)
    return {"hospital_metrics": hm, "peer_groups": pg, "detail": detail, "national": national, "peer_n": peer_n}


# ------------------------------------------------------------------------------------------ national
def build_national(hm, detail, t, params, nat, hc_period, hai_period) -> dict:
    cutoff = float(params["cutoff"])
    fy = int(params.get("fiscal_year", 2026))
    near_band = int(params.get("near_band", 2))
    hac = t["hac_rebuild"]
    hac_src_period = None
    if len(hac):
        h0 = hac.dropna(subset=["hai_start"]).head(1)
        if len(h0):
            r = h0.iloc[0]
            hac_src_period = f"FY{fy} HAC file; PSI 90 {_date(r['psi90_start'])} to {_date(r['psi90_end'])}, HAI {_date(r['hai_start'])} to {_date(r['hai_end'])}"
    hac_src_period = hac_src_period or f"FY{fy} HAC Reduction Program file"

    scored = hm[hm["hac_total"].notna()].copy()
    n_scored = len(scored)
    st = scored["hac_status"].value_counts().to_dict()
    pen = scored[scored["hac_status"] == "penalized"]
    official_yes = int((hac["payment_reduction_official"] == True).sum())  # noqa: E712
    official_eligible = int(hac["payment_reduction_official"].notna().sum())
    yes_no_score = hac[(hac["payment_reduction_official"] == True) & hac["total_official"].isna()]  # noqa: E712
    n_exempt = int((scored["hac_status"] == "exempt").sum())
    # program-eligible = scored and not waived; the denominator for every penalty rate on the site
    elig = scored[scored["hac_status"] != "exempt"]
    # official Yes hospitals that have a score but no Hospital General Information row (so no CareSignal profile)
    yes_unprofiled = hac[(hac["payment_reduction_official"] == True) & hac["total_official"].notna()  # noqa: E712
                         & ~hac["ccn"].isin(hm["ccn"])]

    # histogram
    tot = scored["hac_total"].astype(float).to_numpy()
    lo, hi = math.floor(tot.min() * 4) / 4, math.ceil(tot.max() * 4) / 4
    edges = np.round(np.arange(lo, hi + 0.1001, 0.1), 4)
    counts, edges = np.histogram(tot, bins=edges)

    # adverse weighted HAC points among penalized hospitals, by nursing category
    mm = load_measure_map()
    cats = {m["id"]: m["category"] for m in mm["measures"]}
    pts = {"nursing": 0.0, "shared": 0.0, "other": 0.0}
    for c in pen["ccn"]:
        hb = detail[c]["hac"]
        for m in hb["measures"]:
            if m["contribution"] is not None and m["contribution"] > 0:
                pts[cats.get(m["key"], "other")] += m["contribution"]
    tot_pts = sum(pts.values()) or 1.0
    nursing_share = [{"category": k, "points": v, "share": v / tot_pts} for k, v in pts.items()]

    # tipping measure counts (penalized hospitals)
    tip_counts = pen["tipping_measure"].dropna().value_counts()
    tipping_counts = [{"measure": m, "count": int(tip_counts.get(m, 0))} for m in MEASURES if m != "psi90"]
    pen_le2 = int((pen["tipping_events"].astype(float) <= 2).sum())
    clear_le2 = int((elig["hac_status"].isin(["near", "clear"]) & (elig["min_cushion_events"].astype(float) <= near_band)).sum())

    # by peer / state
    by_peer = []
    for k, g in elig[elig["peer_key"].notna()].groupby("peer_key"):
        np_ = int((g["hac_status"] == "penalized").sum())
        by_peer.append({"key": k, "label": g["peer_label"].iloc[0], "n": len(g), "penalized": np_,
                        "pct": np_ / len(g) * 100, "median_hac": float(g["hac_total"].median())})
    by_peer.sort(key=lambda r: -r["pct"])
    by_state = []
    for s, g in elig.groupby("state"):
        np_ = int((g["hac_status"] == "penalized").sum())
        by_state.append({"state": s, "n": len(g), "penalized": np_, "pct": np_ / len(g) * 100})
    by_state.sort(key=lambda r: r["state"])

    # scatter + correlation
    sc = scored[scored["nurse_comm_top_box"].notna()]
    scatter = [{"ccn": c, "x": float(x), "y": round(float(y), 4)} for c, x, y in zip(sc["ccn"], sc["nurse_comm_top_box"], sc["hac_total"], strict=False)]
    corr = None
    if len(sc) > 2:
        r = float(np.corrcoef(sc["nurse_comm_top_box"].astype(float), sc["hac_total"].astype(float))[0, 1])
        corr = {"r": r, "n": int(len(sc)), "method": "pearson"}

    hc_period_txt = f"{_date(hc_period['start'])} to {_date(hc_period['end'])}" if hc_period else "current HCAHPS file"
    hai_period_txt = f"{_date(hai_period['start'])} to {_date(hai_period['end'])}" if hai_period else "current HAI file"

    insights = []
    insights.append({
        "id": "hac_penalized",
        "title": f"Hospitals receiving the FY{fy} HAC payment reduction",
        "value": f"{official_yes:,} ({official_yes / official_eligible * 100:.1f}%)",
        "detail": f"{official_yes:,} of {official_eligible:,} hospitals with a payment determination are flagged for the 1% "
                  f"reduction; {official_yes - len(yes_no_score):,} of them have a published Total HAC Score"
                  + (f" (CCN {', '.join(yes_no_score['ccn'])} is flagged without a published score)" if len(yes_no_score) else "")
                  + (f"; {len(yes_unprofiled)} scored, flagged hospitals are absent from Hospital General Information, so "
                     f"CareSignal profiles {official_yes - len(yes_no_score) - len(yes_unprofiled):,} penalized hospitals"
                     if len(yes_unprofiled) else "")
                  + f". {n_exempt} Maryland hospitals are scored but waived. Cutoff: Total HAC Score above {cutoff:.5f}.",
        "source": "yq43-i98g", "period": hac_src_period,
    })
    ns = {r["category"]: r["share"] for r in nursing_share}
    insights.append({
        "id": "nursing_share",
        "title": "Share of penalized hospitals' adverse HAC points from nursing-driven measures",
        "value": f"{ns['nursing'] * 100:.1f}%",
        "detail": f"Among penalized hospitals, {ns['nursing'] * 100:.1f}% of above-average weighted z-score points come from CLABSI and CAUTI "
                  f"(nursing-driven), {ns['shared'] * 100:.1f}% from shared measures and {ns['other'] * 100:.1f}% from SSI. "
                  "PSI 90 is counted as shared because its nursing-sensitive components (PSI 03, PSI 08) cannot be split out of the published composite.",
        "source": "yq43-i98g", "period": hac_src_period,
    })
    insights.append({
        "id": "penalized_within_two",
        "title": "Penalized hospitals within 2 infections of clearing the cutoff",
        "value": f"{pen_le2:,} of {len(pen):,}",
        "detail": f"{pen_le2:,} penalized hospitals would fall to or below the cutoff with 2 or fewer prevented infections in a single measure, "
                  "holding peers and the cutoff constant. Predicted counts come from the current HAI file (proxy).",
        "source": "yq43-i98g + 77hc-ibv8", "period": f"{hac_src_period}; predicted counts {hai_period_txt}",
    })
    insights.append({
        "id": "clear_within_two",
        "title": "Clear hospitals within 2 infections of crossing the cutoff",
        "value": f"{clear_le2:,}",
        "detail": f"{clear_le2:,} hospitals below the cutoff would cross it with {near_band} or fewer additional infections in one measure.",
        "source": "yq43-i98g + 77hc-ibv8", "period": f"{hac_src_period}; predicted counts {hai_period_txt}",
    })
    if len(tip_counts):
        top_m, top_n = tip_counts.index[0], int(tip_counts.iloc[0])
        insights.append({
            "id": "top_tipping",
            "title": "Most common tipping measure",
            "value": HAC_LABELS[top_m],
            "detail": f"For {top_n:,} of {int(tip_counts.sum()):,} penalized hospitals with a computable tipping measure, {HAC_LABELS[top_m]} "
                      "is the measure needing the fewest prevented infections to clear the cutoff.",
            "source": "yq43-i98g + 77hc-ibv8", "period": f"{hac_src_period}; predicted counts {hai_period_txt}",
        })
    if corr:
        insights.append({
            "id": "nurse_comm_corr",
            "title": "Nurse communication vs Total HAC Score",
            "value": f"r = {corr['r']:.2f}",
            "detail": f"Pearson correlation across {corr['n']:,} hospitals between HCAHPS nurse communication top-box and Total HAC Score. "
                      "This is a correlation, not causation, and the two files cover different periods.",
            "source": "dgck-syfz + yq43-i98g", "period": f"HCAHPS {hc_period_txt}; {hac_src_period}",
        })
    if by_peer:
        big = [r for r in by_peer if r["n"] >= 30]
        if big:
            top = big[0]
            insights.append({
                "id": "peer_highest",
                "title": "Peer group with the highest penalty rate (≥30 hospitals)",
                "value": f"{top['pct']:.1f}%",
                "detail": f"{top['label']}: {top['penalized']} of {top['n']} hospitals penalized.",
                "source": "yq43-i98g + cost report", "period": hac_src_period,
            })

    return {
        "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "hac_params": {"fiscal_year": fy, "cutoff": cutoff, "near_band": near_band,
                       "measures": {m: {k: params["measures"][m][k] for k in ("winsor_low", "winsor_high", "mean", "sd", "n")} for m in MEASURES}},
        "counts": {"facilities": int(len(hm)), "hac_scored": int(n_scored), "penalized": int(st.get("penalized", 0)),
                   "near": int(st.get("near", 0)), "clear": int(st.get("clear", 0)), "exempt": n_exempt,
                   "official_flagged": official_yes, "official_determinations": official_eligible},
        "peer_groups": [{"key": k, "label": g["peer_label"].iloc[0], "n": int(len(g))}
                        for k, g in hm[hm["peer_key"].notna()].groupby("peer_key")],
        "insights": insights,
        "hac_histogram": {"bins": [float(e) for e in edges], "counts": [int(c) for c in counts]},
        "nursing_share": nursing_share,
        "tipping_counts": tipping_counts,
        "within_two": {"penalized_clear_with_le2": pen_le2, "clear_cross_with_le2": clear_le2},
        "by_peer": by_peer,
        "by_state": by_state,
        "scatter_nurse_comm_vs_hac": scatter,
        "correlation": corr,
        "hcahps_national": {k: _num(v) for k, v in nat.items()},
    }


def main() -> None:
    t = load_inputs()
    out = build(t)
    hm = out["hospital_metrics"]
    obj_cols = [c for c in hm.columns if hm[c].dtype == object and c not in ("ccn", "name", "city", "state", "hospital_type", "peer_key", "peer_label", "bed_band", "teaching", "urban_rural", "region", "hac_status", "tipping_measure", "traj_status")]
    for c in obj_cols:
        if c in ("payment_reduction", "peer_fallback"):
            hm[c] = hm[c].astype("boolean")
        else:
            try:
                hm[c] = pd.to_numeric(hm[c])
            except (TypeError, ValueError):
                pass
    for c in ("tipping_events", "min_cushion_events", *[f"ptp_{m}_events" for m in MEASURES]):
        hm[c] = pd.to_numeric(hm[c], errors="coerce").astype("Int64")
    hm.to_parquet(PROCESSED / "hospital_metrics.parquet", index=False)
    out["peer_groups"].to_parquet(PROCESSED / "peer_groups.parquet", index=False)
    with open(PROCESSED / "national.json", "w") as f:
        json.dump(out["national"], f, indent=1, default=float)
    with open(PROCESSED / "hospital_detail.pkl", "wb") as f:
        pickle.dump(out["detail"], f)
    c = out["national"]["counts"]
    print(f"metrics: {c['facilities']} facilities, {c['hac_scored']} HAC-scored, {c['penalized']} penalized, "
          f"{c['near']} near, {c['clear']} clear; {len(out['peer_groups'])} peer groups")
    for i in out["national"]["insights"]:
        print(f"  - {i['title']}: {i['value']}")


if __name__ == "__main__":
    main()
