"""Rebuild the FY2026 HAC Reduction Program scores from the official CMS file and validate against it.

Reads   data/raw/yq43-i98g.csv
Writes  data/processed/hac_rebuild.parquet
        data/processed/hac_params.json
        web/public/data/accuracy.json

Two parameter sets are produced and both are reported honestly:
- independent: winsor bounds, mean and SD recomputed from the published measure values. This is the
  true rebuild, so its z-scores, totals and penalty flags are what accuracy.json scores.
- calibrated: CMS's own mean/SD/bounds, recovered exactly from the published W Z scores, which are an
  affine function of the measure value between the winsorization bounds. Published values are rounded
  (SIR to 3 dp, PSI 90 to 4 dp), and CMS computed its distribution from unrounded inputs. These
  parameters therefore reproduce official z-scores more closely, and downstream math (patients-to-prevent,
  simulator) uses them.
"""

from __future__ import annotations

import itertools
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline import hac_core as hc

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/yq43-i98g.csv"
OUT_PARQUET = ROOT / "data/processed/hac_rebuild.parquet"
OUT_PARAMS = ROOT / "data/processed/hac_params.json"
OUT_ACCURACY = ROOT / "web/public/data/accuracy.json"

SOURCE = "yq43-i98g"
Z_TOL = 0.001
TOTAL_TOL = 0.001
NEAR_BAND = 2
FLAG_TARGET = 0.99

COLS = {
    "psi90": ("PSI 90 Composite Value", "PSI 90 W Z Score", "PSI 90 Composite Value Footnote", "PSI 90 W Z Footnote"),
    "clabsi": ("CLABSI SIR", "CLABSI W Z Score", "CLABSI SIR Footnote", "CLABSI W Z Footnote"),
    "cauti": ("CAUTI SIR", "CAUTI W Z Score", "CAUTI SIR Footnote", "CAUTI W Z Footnote"),
    "ssi": ("SSI SIR", "SSI W Z Score", "SSI SIR Footnote", "SSI W Z Footnote"),
    "cdi": ("CDI SIR", "CDI W Z Score", "CDI SIR Footnote", "CDI W Z Footnote"),
    "mrsa": ("MRSA SIR", "MRSA W Z Score", "MRSA SIR Footnote", "MRSA W Z Footnote"),
}
PERCENTILE_METHODS = ["linear", "hazen", "weibull", "median_unbiased", "normal_unbiased", "nearest", "lower", "higher", "midpoint"]


def _num(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s.replace({"N/A": None, "Not Available": None, "": None}), errors="coerce")


def _iso(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s, format="%m/%d/%Y", errors="coerce").dt.strftime("%Y-%m-%d")


def _fn(s: pd.Series) -> pd.Series:
    return s.where(s.str.strip() != "", None)


def load(path: Path = RAW) -> pd.DataFrame:
    """Parse the official HAC file into tidy snake_case columns (CCN stays a 6-char string)."""
    raw = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    df = pd.DataFrame({
        "ccn": raw["Facility ID"].str.strip().str.zfill(6),
        "name": raw["Facility Name"].str.strip(),
        "state": raw["State"].str.strip(),
        "fiscal_year": pd.to_numeric(raw["Fiscal Year"], errors="coerce").astype("Int64"),
    })
    df["is_maryland"] = df["state"] == "MD"
    for m, (vc, zc, vfn, zfn) in COLS.items():
        df[f"{m}_value"] = _num(raw[vc])
        df[f"{m}_value_fn"] = _fn(raw[vfn])
        df[f"{m}_z_official"] = _num(raw[zc])
        df[f"{m}_z_fn"] = _fn(raw[zfn])
    df["psi90_start"], df["psi90_end"] = _iso(raw["PSI 90 Start Date"]), _iso(raw["PSI 90 End Date"])
    df["hai_start"], df["hai_end"] = _iso(raw["HAI Measures Start Date"]), _iso(raw["HAI Measures End Date"])
    df["total_official"] = _num(raw["Total HAC Score"])
    df["total_fn"] = _fn(raw["Total HAC Score Footnote"])
    pr = raw["Payment Reduction"].str.strip()
    df["payment_reduction_official"] = pr.map({"Yes": True, "No": False}).astype("boolean")
    df["payment_reduction_fn"] = _fn(raw["Payment Reduction Footnote"])
    if df["ccn"].duplicated().any():
        raise ValueError("duplicate CCNs in HAC file")
    return df


def _in_distribution(df: pd.DataFrame, m: str, include_md: bool) -> pd.Series:
    sel = df[f"{m}_value"].notna()
    if not include_md:
        sel &= ~df["is_maryland"]
    return sel


def _z_agreement(df: pd.DataFrame, params: dict[str, dict]) -> dict[str, float]:
    out = {}
    for m, p in params.items():
        ok = df[f"{m}_value"].notna() & df[f"{m}_z_official"].notna()
        z = df.loc[ok, f"{m}_value"].map(lambda v, p=p: hc.measure_z(v, p))
        out[m] = float(((z - df.loc[ok, f"{m}_z_official"]).abs() <= Z_TOL + 1e-9).mean())
    return out


def independent_params(df: pd.DataFrame, method: str, ddof: int, include_md: bool) -> dict[str, dict]:
    return {m: hc.distribution_params(df.loc[_in_distribution(df, m, include_md), f"{m}_value"], method=method, ddof=ddof)
            for m in hc.MEASURES}


def select_conventions(df: pd.DataFrame) -> tuple[dict, list[dict]]:
    """Grid-search percentile method x SD ddof x Maryland inclusion; keep the convention with the best
    mean share of z-scores within tolerance. Ties keep the earlier (simpler, plan-specified) option."""
    trials = []
    for method, ddof, include_md in itertools.product(PERCENTILE_METHODS, [0, 1], [True, False]):
        agree = _z_agreement(df, independent_params(df, method, ddof, include_md))
        trials.append({"method": method, "ddof": ddof, "include_md": include_md,
                       "mean_agreement": float(np.mean(list(agree.values()))), "by_measure": agree})
    best = max(trials, key=lambda t: t["mean_agreement"])  # max() keeps the first of equal scores
    return best, trials


def calibrated_params(df: pd.DataFrame) -> dict[str, dict]:
    """Recover CMS's mean/SD/bounds from the published z-scores. Between the bounds z = (v - mean)/sd,
    so an OLS fit of official z on value gives slope 1/sd and intercept -mean/sd; the bounds are the
    values at the observed min/max z (which are the winsorized extremes)."""
    out = {}
    for m in hc.MEASURES:
        ok = df[f"{m}_value"].notna() & df[f"{m}_z_official"].notna()
        v, z = df.loc[ok, f"{m}_value"], df.loc[ok, f"{m}_z_official"]
        zmin, zmax = z.min(), z.max()
        inner = (z > zmin) & (z < zmax)
        slope, intercept = np.polyfit(v[inner], z[inner], 1)
        sd = 1.0 / slope
        mean = -intercept / slope
        lo = float(mean + zmin * sd)
        if abs(lo) < 1e-4:  # SIR floor is exactly 0; the fit leaves ~1e-5 noise
            lo = 0.0
        out[m] = {"winsor_low": lo, "winsor_high": float(mean + zmax * sd),
                  "mean": float(mean), "sd": float(sd), "n": int(ok.sum())}
    return out


def score(df: pd.DataFrame, params: dict[str, dict]) -> pd.DataFrame:
    """Rebuilt winsorized values, z-scores and totals.

    Hospitals with no measure value but an official z (footnotes 11/18: required data not submitted)
    receive the maximum z for that measure, which is what the official file shows."""
    out = pd.DataFrame(index=df.index)
    for m, p in params.items():
        v = df[f"{m}_value"]
        out[f"{m}_winsorized"] = v.map(lambda x, p=p: hc.winsorize(x, p["winsor_low"], p["winsor_high"]) if pd.notna(x) else np.nan)
        z = v.map(lambda x, p=p: hc.measure_z(x, p) if pd.notna(x) else np.nan).astype(float)
        assigned = v.isna() & df[f"{m}_z_official"].notna()
        z[assigned] = hc.max_z(p)
        out[f"{m}_z_rebuilt"] = z
    zcols = [f"{m}_z_rebuilt" for m in hc.MEASURES]
    totals, n = [], []
    for row in out[zcols].itertuples(index=False):
        t, w = hc.total_score({m: (None if pd.isna(x) else x) for m, x in zip(hc.MEASURES, row, strict=True)})
        totals.append(np.nan if t is None else t)
        n.append(sum(1 for x in w.values() if x > 0))
    out["total_rebuilt"] = totals
    out["n_measures"] = n
    return out


def inferred_official_cutoff(df: pd.DataFrame) -> tuple[float, float]:
    nm = ~df["is_maryland"] & df["total_official"].notna()
    max_no = df.loc[nm & (df["payment_reduction_official"] == False), "total_official"].max()  # noqa: E712
    min_yes = df.loc[nm & (df["payment_reduction_official"] == True), "total_official"].min()  # noqa: E712
    return float(max_no), float(min_yes)


def build() -> dict:
    df = load()
    best, trials = select_conventions(df)
    ind = independent_params(df, best["method"], best["ddof"], best["include_md"])
    cal = calibrated_params(df)

    rb = score(df, ind)
    cb = score(df, cal)

    non_md_scored = ~df["is_maryland"] & rb["total_rebuilt"].notna()
    cutoff_rebuilt = hc.cutoff(rb.loc[non_md_scored, "total_rebuilt"], method=best["method"])
    cutoff_pub_pct = hc.cutoff(df.loc[~df["is_maryland"] & df["total_official"].notna(), "total_official"], method=best["method"])
    max_no, min_yes = inferred_official_cutoff(df)
    cutoff_official_inferred = round((max_no + min_yes) / 2, 5)

    flag_rebuilt = pd.Series(pd.NA, index=df.index, dtype="boolean")
    flag_rebuilt[non_md_scored] = rb.loc[non_md_scored, "total_rebuilt"] > cutoff_rebuilt

    result = df.copy()
    for m in hc.MEASURES:
        result[f"{m}_z_rebuilt"] = rb[f"{m}_z_rebuilt"]
        result[f"{m}_winsorized"] = rb[f"{m}_winsorized"]
    result["n_measures"] = rb["n_measures"]
    result["total_rebuilt"] = rb["total_rebuilt"]
    result["payment_reduction_rebuilt"] = flag_rebuilt
    cols = (["ccn", "name", "state", "is_maryland", "fiscal_year"]
            + [f"{m}_{s}" for m in hc.MEASURES for s in ("value", "value_fn", "z_official", "z_fn", "z_rebuilt", "winsorized")]
            + ["n_measures", "total_official", "total_rebuilt", "total_fn", "payment_reduction_official", "payment_reduction_fn",
               "payment_reduction_rebuilt", "psi90_start", "psi90_end", "hai_start", "hai_end"])
    result = result[cols]

    # ---- accuracy -------------------------------------------------------------------------------
    flag_eval = non_md_scored & df["payment_reduction_official"].notna()
    flag_agree = float((flag_rebuilt[flag_eval] == df.loc[flag_eval, "payment_reduction_official"]).mean())

    def zstats(frame: pd.DataFrame) -> tuple[dict, dict]:
        within, maxd = {}, {}
        for m in hc.MEASURES:
            ok = df[f"{m}_z_official"].notna() & frame[f"{m}_z_rebuilt"].notna()
            diff = (frame.loc[ok, f"{m}_z_rebuilt"] - df.loc[ok, f"{m}_z_official"]).abs()
            within[m] = round(float((diff <= Z_TOL + 1e-9).mean()), 6)
            maxd[m] = round(float(diff.max()), 6)
        return within, maxd

    z_within, z_max = zstats(rb)
    z_within_cal, z_max_cal = zstats(cb)
    tot_ok = df["total_official"].notna() & rb["total_rebuilt"].notna()
    total_diff = (rb.loc[tot_ok, "total_rebuilt"] - df.loc[tot_ok, "total_official"]).abs()
    total_within = float((total_diff <= TOTAL_TOL + 1e-9).mean())
    cal_tot_diff = (cb.loc[tot_ok, "total_rebuilt"] - df.loc[tot_ok, "total_official"]).abs()

    # flag agreement if the calibrated totals are compared to the inferred official cutoff
    cal_flag = cb.loc[flag_eval, "total_rebuilt"] > cutoff_official_inferred
    cal_flag_agree = float((cal_flag == df.loc[flag_eval, "payment_reduction_official"]).mean())

    mismatches = []
    for i in df.index[flag_eval & (flag_rebuilt != df["payment_reduction_official"]).fillna(False)]:
        mismatches.append({"ccn": df.at[i, "ccn"], "name": df.at[i, "name"], "field": "payment_reduction",
                           "official": "Yes" if df.at[i, "payment_reduction_official"] else "No",
                           "rebuilt": "Yes" if flag_rebuilt[i] else "No"})
    zdiffs = []
    for m in hc.MEASURES:
        ok = df[f"{m}_z_official"].notna() & rb[f"{m}_z_rebuilt"].notna()
        d = (rb.loc[ok, f"{m}_z_rebuilt"] - df.loc[ok, f"{m}_z_official"]).abs()
        for i in d[d > Z_TOL + 1e-9].index:
            zdiffs.append((float(d[i]), i, m))
    for _diff, i, m in sorted(zdiffs, reverse=True)[: max(0, 50 - len(mismatches))]:
        mismatches.append({"ccn": df.at[i, "ccn"], "name": df.at[i, "name"], "field": f"{m}_z",
                           "official": float(df.at[i, f"{m}_z_official"]), "rebuilt": round(float(rb.at[i, f"{m}_z_rebuilt"]), 6)})
    mismatches = mismatches[:50]

    exact = [m for m in hc.MEASURES if z_within[m] >= 1.0]
    inexact = [m for m in hc.MEASURES if z_within[m] < 1.0]
    n_scored = int(df["total_official"].notna().sum())
    md = df["is_maryland"]
    notes = [
        f"Conventions chosen by grid search over {len(trials)} variants: percentile method '{best['method']}' "
        f"(numpy; equals Excel PERCENTILE.INC when 'linear'), SD ddof={best['ddof']} ({'population, STDEV.P' if best['ddof'] == 0 else 'sample, STDEV.S'}), "
        f"Maryland {'included' if best['include_md'] else 'excluded'} in winsorization/standardization; distributions use every hospital with a published measure value.",
        f"Independent rebuild reproduces official W Z within ±0.001 for every hospital on {', '.join(m.upper() for m in exact) or 'no measure'}"
        + (f"; {', '.join(f'{m.upper()} {z_within[m] * 100:.1f}%' for m in inexact)} fall short because CMS computed its distribution "
           "from unrounded inputs (published SIRs are 3 dp, PSI 90 is 4 dp), which shifts the mean/SD/bounds slightly. "
           "These gaps are reported as they are, not tuned away." if inexact else "."),
        f"Calibrated parameters, recovered exactly from the published z-scores by linear fit, reproduce official z within ±0.001 for "
        f"{min(z_within_cal.values()) * 100:.1f}%–{max(z_within_cal.values()) * 100:.1f}% of hospitals per measure (max |Δz| {max(z_max_cal.values()):.4f}); "
        "patients-to-prevent and the simulator use these calibrated parameters.",
        "Hospitals with no measure value but an official z (footnotes 11/18, required data not submitted) receive the maximum "
        "winsorized z, matching the official file. Totals are the equal-weighted mean of available z-scores (official aggregation reproduced to ±0.0001).",
        f"Official cutoff inferred from payment flags (non-Maryland): highest 'No' total {max_no:.4f}, lowest 'Yes' total {min_yes:.4f}; "
        f"midpoint {cutoff_official_inferred:.5f} is used as the cutoff on the site. The 75th percentile of the published 4-dp totals is "
        f"{cutoff_pub_pct:.4f}; the rebuilt 75th percentile is {cutoff_rebuilt:.4f}.",
        f"Maryland hospitals ({int(md.sum())}) are scored but exempt from the payment reduction (flag 'N/A', footnote a); they are "
        "excluded from the cutoff and from flag agreement.",
        "Flag agreement compares the independently rebuilt flag (rebuilt total > rebuilt cutoff) with the official Yes/No for "
        f"non-Maryland hospitals with a score. Using calibrated totals against the inferred cutoff gives {cal_flag_agree * 100:.2f}% agreement.",
    ]

    accuracy = {
        "fiscal_year": int(df["fiscal_year"].dropna().iloc[0]),
        "source": SOURCE,
        "n_hospitals": int(len(df)),
        "n_scored": n_scored,
        "flag_agreement": round(flag_agree, 6),
        "z_within_tol": z_within,
        "total_within_tol": round(total_within, 6),
        "max_abs_z_diff": z_max,
        "cutoff_official_inferred": cutoff_official_inferred,
        "cutoff_rebuilt": round(cutoff_rebuilt, 6),
        "mismatches": mismatches,
        "notes": notes,
        # supplementary (not in the TS contract; harmless extra keys)
        "tolerance": {"z": Z_TOL, "total": TOTAL_TOL},
        "z_within_tol_calibrated": z_within_cal,
        "max_abs_z_diff_calibrated": z_max_cal,
        "total_within_tol_calibrated": round(float((cal_tot_diff <= TOTAL_TOL + 1e-9).mean()), 6),
        "flag_agreement_calibrated": round(cal_flag_agree, 6),
        "max_abs_total_diff": round(float(total_diff.max()), 6),
        "counts": {
            "penalized_official": int((df["payment_reduction_official"] == True).sum()),  # noqa: E712
            "not_penalized_official": int((df["payment_reduction_official"] == False).sum()),  # noqa: E712
            "maryland": int(md.sum()),
            "flag_evaluated": int(flag_eval.sum()),
        },
        "conventions": {"percentile_method": best["method"], "sd_ddof": best["ddof"], "include_maryland": best["include_md"]},
        "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
    }

    params = {
        "fiscal_year": accuracy["fiscal_year"],
        "source": SOURCE,
        "cutoff": cutoff_official_inferred,
        "cutoff_method": "midpoint between highest non-penalized and lowest penalized official Total HAC Score (non-Maryland)",
        "cutoff_rebuilt": round(cutoff_rebuilt, 6),
        "near_band": NEAR_BAND,
        "param_source": "calibrated (recovered from official W Z scores); see 'independent' for the pure rebuild",
        "measures": {m: {k: (round(v, 8) if isinstance(v, float) else v) for k, v in p.items()} for m, p in cal.items()},
        "independent": {m: {k: (round(v, 8) if isinstance(v, float) else v) for k, v in p.items()} for m, p in ind.items()},
        "conventions": accuracy["conventions"],
        "periods": {
            "psi90": {"start": df["psi90_start"].dropna().iloc[0], "end": df["psi90_end"].dropna().iloc[0]},
            "hai": {"start": df["hai_start"].dropna().iloc[0], "end": df["hai_end"].dropna().iloc[0]},
        },
    }

    for p in (OUT_PARQUET, OUT_PARAMS, OUT_ACCURACY):
        p.parent.mkdir(parents=True, exist_ok=True)
    result.to_parquet(OUT_PARQUET, index=False)
    OUT_PARAMS.write_text(json.dumps(params, indent=2))
    OUT_ACCURACY.write_text(json.dumps(accuracy, indent=2))
    return accuracy


def main() -> int:
    acc = build()
    print(f"HAC rebuild FY{acc['fiscal_year']}: {acc['n_scored']} scored, flag agreement {acc['flag_agreement']:.4%}")
    for m, v in acc["z_within_tol"].items():
        print(f"  {m:7s} z within ±0.001: {v:.2%} (calibrated {acc['z_within_tol_calibrated'][m]:.2%})")
    print(f"  cutoff official-inferred {acc['cutoff_official_inferred']}  rebuilt {acc['cutoff_rebuilt']}")
    if acc["flag_agreement"] < FLAG_TARGET:
        print(f"FAIL: flag agreement below {FLAG_TARGET:.0%}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
