"""Recalculate CareSignal_Workbook.xlsx in headless LibreOffice and compare formula results to Python outputs.

Checks (tolerance 1e-6 unless noted):
  - winsor bounds, mean, SD per measure  vs data/processed/hac_params.json
  - formula cutoff                        vs hac_params.json cutoff
  - formula Total HAC + z-scores, all hospitals vs hac_rebuild.parquet total_rebuilt / z_rebuilt
  - formula patients-to-prevent for the selected hospital vs hospital_metrics ptp_*_events (exact)

Without LibreOffice it falls back to a Python evaluator of the same formula logic and says so.

Usage: python scripts/recalc_check.py [path/to/workbook.xlsx]
Exit code 1 on any mismatch.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.export_excel import HAC_MEASURES, HAI_MEASURES, OUT  # noqa: E402
from pipeline.plain_text import plain  # noqa: E402

TOL = 1e-6
PROCESSED = ROOT / "data" / "processed"


def find_soffice() -> str | None:
    for c in ("soffice", "libreoffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"):
        p = shutil.which(c) or (c if Path(c).exists() else None)
        if p:
            return p
    return None


def recalc(path: Path, soffice: str) -> Path:
    out_dir = Path(tempfile.mkdtemp(prefix="recalc_"))
    profile = Path(tempfile.mkdtemp(prefix="lo_profile_"))
    cmd = [
        soffice,
        f"-env:UserInstallation=file://{profile}",
        "--headless",
        "--calc",
        "--convert-to",
        "xlsx:Calc MS Excel 2007 XML",
        "--outdir",
        str(out_dir),
        str(path),
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=900)
    return out_dir / path.name


def _num(v):
    return v if isinstance(v, int | float) and not isinstance(v, bool) else None


def _cmp(errs, label, got, exp, tol):
    ok = got is not None and exp is not None and abs(got - exp) <= tol
    print(f"  {label:28} xl={got!r:<22} py={exp!r:<22} {'OK' if ok else 'MISMATCH'}")
    if not ok:
        errs.append(f"{label}: xl={got} py={exp}")


def _series_check(errs, label, got: pd.Series, exp: pd.Series, tol: float) -> None:
    got = pd.to_numeric(got, errors="coerce")
    exp = pd.to_numeric(exp, errors="coerce")
    either = got.notna() | exp.notna()
    good = got.notna() & exp.notna() & ((got - exp).abs() <= tol)
    n_bad = int((either & ~good).sum())
    print(
        f"  {label:28} {int(good.sum())}/{int(either.sum())} within {tol:g}"
        + ("" if not n_bad else f"  max|Δ|={float((got - exp).abs().max()):.2e}")
    )
    if n_bad:
        errs.append(f"{label}: {n_bad} outside tolerance")


def check(values_path: Path, mode: str) -> list[str]:
    """mode 'calibrated': active params = CMS-calibrated, compare to the OFFICIAL file (z ±0.001 as in the plan)
    mode 'formula': active params = live formula rebuild, compare to the pipeline's independent rebuild (1e-6)."""
    errs: list[str] = []
    params = json.loads((PROCESSED / "hac_params.json").read_text())
    hac = pd.read_parquet(PROCESSED / "hac_rebuild.parquet")
    hac["ccn"] = hac["ccn"].astype(str).str.zfill(6)
    wb = load_workbook(values_path, data_only=True)
    calc = wb["HAC Calculator"]
    print(f"\n[{mode}] parameter source cell = {calc['C5'].value!r}")
    indep = params.get("independent", params["measures"])
    for i, m in enumerate(HAC_MEASURES):
        r = 7 + i
        for col, key in zip("DEFG", ("winsor_low", "winsor_high", "mean", "sd"), strict=False):
            _cmp(errs, f"{m} formula {key}", _num(calc[f"{col}{r}"].value), indep[m][key], 2e-6)
        if mode == "calibrated":
            for col, key in zip("MNOP", ("winsor_low", "winsor_high", "mean", "sd"), strict=False):
                _cmp(errs, f"{m} active {key}", _num(calc[f"{col}{r}"].value), params["measures"][m][key], 1e-9)

    data = wb["Data"]
    rows = list(data.iter_rows(values_only=True))
    xl = pd.DataFrame(rows[1:], columns=rows[0])
    xl["CCN"] = xl["CCN"].astype(str).str.zfill(6)
    mg = xl.merge(hac, left_on="CCN", right_on="ccn", how="inner")
    if mode == "calibrated":
        _cmp(errs, "cutoff in use", _num(calc["D15"].value), params["cutoff"], 1e-9)
        for m in HAC_MEASURES:
            _series_check(errs, f"z {m} vs official", mg[f"{m.upper()} z (formula)"], mg[f"{m}_z_official"], 1e-3)
        _series_check(errs, "Total HAC vs official", mg["Total HAC (formula)"], mg["total_official"], 1e-3)
    else:
        if "cutoff_rebuilt" in params:
            _cmp(errs, "cutoff (formula pct)", _num(calc["D16"].value), params["cutoff_rebuilt"], 2e-6)
        for m in HAC_MEASURES:
            _series_check(errs, f"z {m} vs rebuild", mg[f"{m.upper()} z (formula)"], mg[f"{m}_z_rebuilt"], 1e-6)
        _series_check(errs, "Total HAC vs rebuild", mg["Total HAC (formula)"], mg["total_rebuilt"], 1e-6)
    ref = "total_official" if mode == "calibrated" else "total_rebuilt"
    print(f"  first 20 scored hospitals (CCN, xl total, {ref}):")
    for _, r in mg.dropna(subset=[ref]).head(20).iterrows():
        print(f"    {r['CCN']}  {r['Total HAC (formula)']!r:<24} {r[ref]!r}")

    if mode == "calibrated":
        ptp = wb["Patients to Prevent"]
        hm = pd.read_parquet(PROCESSED / "hospital_metrics.parquet")
        hm["ccn"] = hm["ccn"].astype(str).str.zfill(6)
        sel = wb["Hospital Lookup"]["C6"].value
        hrow = hm.loc[hm["ccn"] == str(sel)]
        print(f"  patients-to-prevent for selected {sel}:")
        for i, m in enumerate(HAC_MEASURES):
            if m not in HAI_MEASURES:
                continue
            got = ptp[f"J{13 + i}"].value
            exp = hrow[f"ptp_{m}_events"].iloc[0] if len(hrow) else None
            exp = None if exp is None or pd.isna(exp) else int(exp)
            gotn = int(got) if _num(got) is not None else None
            print(f"    {m:6} xl={got!r:<16} py={exp!r:<8} {'OK' if gotn == exp else 'DIFF'}")
            if gotn != exp:
                errs.append(f"ptp {m}: xl={got} py={exp}")
    return errs


def ptp_sweep(path: Path, soffice: str, ccns: list[str]) -> list[str]:
    """Recalculate Patients to Prevent for several hospitals (one workbook copy each) vs metrics.py."""
    errs: list[str] = []
    hm = pd.read_parquet(PROCESSED / "hospital_metrics.parquet")
    hm["ccn"] = hm["ccn"].astype(str).str.zfill(6)
    tmp = Path(tempfile.mkdtemp(prefix="ptp_"))
    for ccn in ccns:
        wb = load_workbook(path)
        name = hm.loc[hm["ccn"] == ccn, "name"].iloc[0]
        wb["Hospital Lookup"]["C5"] = plain(f"{ccn} — {name}")  # same text pass as the workbook
        f = tmp / f"ptp_{ccn}.xlsx"
        wb.save(f)
        out = load_workbook(recalc(f, soffice), data_only=True)["Patients to Prevent"]
        hrow = hm.loc[hm["ccn"] == ccn].iloc[0]
        line = []
        for i, m in enumerate(HAC_MEASURES):
            if m not in HAI_MEASURES:
                continue
            got = out[f"J{13 + i}"].value
            exp = hrow[f"ptp_{m}_events"]
            exp = None if pd.isna(exp) else int(exp)
            gotn = int(got) if _num(got) is not None else None
            line.append(f"{m}={got}/{exp}")
            if gotn != exp:
                errs.append(f"ptp {ccn} {m}: xl={got} py={exp}")
        print(f"  {ccn}: " + "  ".join(line))
    return errs


def python_evaluator(path: Path) -> list[str]:
    """Fallback: evaluate the workbook's formula logic in numpy from the workbook's own input values."""
    wb = load_workbook(path, read_only=True)
    data = wb["Data"]
    rows = list(data.iter_rows(values_only=True))
    df = pd.DataFrame(rows[1:], columns=rows[0])
    params = json.loads((PROCESSED / "hac_params.json").read_text())
    errs = []
    z = {}
    for m in HAC_MEASURES:
        v = pd.to_numeric(df[f"{m.upper()} value (scored)"], errors="coerce")
        lo, hi = np.percentile(v.dropna(), [5, 95])  # == PERCENTILE.INC (linear)
        w = v.clip(lo, hi)
        mean, sd = w.mean(), w.std(ddof=0)
        pm = params["measures"][m]
        for k, got in (("winsor_low", lo), ("winsor_high", hi), ("mean", mean), ("sd", sd)):
            if abs(got - pm[k]) > TOL:
                errs.append(f"{m}.{k}: {got} vs {pm[k]}")
        z[m] = (w - mean) / sd
    total = pd.DataFrame(z).mean(axis=1, skipna=True)
    md = df.get("Maryland (waived)")
    nonmd = total[(md != "Yes") if md is not None else slice(None)].dropna()
    cut = np.percentile(nonmd, 75)
    print(f"[python-evaluator] cutoff={cut} pipeline={params['cutoff']}")
    if abs(cut - params["cutoff"]) > TOL:
        errs.append(f"cutoff: {cut} vs {params['cutoff']}")
    return errs


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT
    soffice = find_soffice()
    if soffice:
        print(f"Recalculating {path.name} with LibreOffice ({soffice}) …")
        errs = check(recalc(path, soffice), "calibrated")
        # Same workbook with the switch flipped to the live formula rebuild.
        wb = load_workbook(path)
        wb["HAC Calculator"]["C5"] = "Formula rebuild"
        alt = Path(tempfile.mkdtemp(prefix="formula_")) / path.name
        wb.save(alt)
        errs += check(recalc(alt, soffice), "formula")
        hm = pd.read_parquet(PROCESSED / "hospital_metrics.parquet")
        pen = hm.loc[hm["hac_status"] == "penalized", "ccn"].astype(str).str.zfill(6).head(6).tolist()
        print("\n[patients-to-prevent sweep] events xl/py:")
        errs += ptp_sweep(path, soffice, pen)
    else:
        print("LibreOffice not found — LibreOffice recalc NOT run; using Python evaluator of the same logic.")
        errs = python_evaluator(path)
    if errs:
        print(f"\nFAIL: {len(errs)} issue(s)")
        for e in errs[:40]:
            print("  -", e)
        return 1
    print("\nPASS: workbook formulas match pipeline outputs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
