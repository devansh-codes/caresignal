"""Rule-based validation of the raw CMS files.

Every rule records how many values it checked and how many failed. The log is published on the
Data Quality page. Any failed rule with severity 'error' exits 1, which stops the build so the
previous site stays live.

Usage: python -m pipeline.validate
"""
from __future__ import annotations

import json
import logging
import re
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
SITE_DATA = ROOT / "web" / "public" / "data"
CONFIG = ROOT / "config" / "datasets.yaml"

MISSING = {"Not Available", "N/A", "Not Applicable", "NA", ""}
CCN_RE = re.compile(r"^[0-9A-Z]{6}$")
DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")

log = logging.getLogger("validate")


@dataclass
class Rule:
    rule_id: str
    dataset: str
    description: str
    severity: str  # 'error' | 'warn' | 'info'
    checked: int
    failed: int
    passed: bool


class Validator:
    def __init__(self) -> None:
        self.rules: list[Rule] = []

    def add(self, rule_id: str, dataset: str, description: str, severity: str, checked: int, failed: int,
            passed: bool | None = None) -> None:
        if passed is None:
            passed = failed == 0 or severity == "info"
        self.rules.append(Rule(rule_id, dataset, description, severity, int(checked), int(failed), bool(passed)))

    @property
    def errors(self) -> list[Rule]:
        return [r for r in self.rules if r.severity == "error" and not r.passed]


# ---------------------------------------------------------------- helpers

def read_raw(path: Path) -> pd.DataFrame:
    """Everything as text; nothing becomes NaN (so 'N/A' and leading zeros survive)."""
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return pd.read_csv(path, dtype=str, keep_default_na=False, encoding=enc)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"cannot decode {path}")


def present(s: pd.Series) -> pd.Series:
    """Values that are not a CMS missing marker."""
    return ~s.str.strip().isin(MISSING)


def numeric(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s.str.strip().str.replace(",", "", regex=False), errors="coerce")


# Value columns whose non-missing entries must parse as numbers, per dataset.
VALUE_COLUMNS: dict[str, list[str]] = {
    "77hc-ibv8": ["Score"],
    "dgck-syfz": ["HCAHPS Answer Percent", "HCAHPS Linear Mean Value", "Number of Completed Surveys",
                  "Survey Response Rate Percent"],
    "ynj2-r877": ["Score", "Denominator", "Lower Estimate", "Higher Estimate"],
    "muwa-iene": ["Rate"],
    "yq43-i98g": ["PSI 90 Composite Value", "PSI 90 W Z Score", "CLABSI SIR", "CLABSI W Z Score", "CAUTI SIR",
                  "CAUTI W Z Score", "SSI SIR", "SSI W Z Score", "CDI SIR", "CDI W Z Score", "MRSA SIR",
                  "MRSA W Z Score", "Total HAC Score"],
    "9n3s-kdb3": ["Excess Readmission Ratio", "Predicted Readmission Rate", "Expected Readmission Rate",
                  "Number of Discharges"],
    "ypbt-wvdk": ["Total Performance Score"],
    "632h-zaca": ["Score", "Denominator"],
    "99ue-w85f": ["HCAHPS Answer Percent"],
    "84jm-wiui": ["HCAHPS Answer Percent"],
    "cost_report": ["Number of Beds", "Number of Interns and Residents (FTE)"],
    "medicare_inpatient": ["Tot_Pymt_Amt", "Tot_Mdcr_Pymt_Amt", "Tot_Dschrgs"],
}

HAC_SIR_COLS = ["CLABSI SIR", "CAUTI SIR", "SSI SIR", "CDI SIR", "MRSA SIR"]
HAC_Z_COLS = ["PSI 90 W Z Score", "CLABSI W Z Score", "CAUTI W Z Score", "SSI W Z Score", "CDI W Z Score",
              "MRSA W Z Score"]
# value column -> its footnote column, for the "numeric and footnoted" info rule
HAC_FOOTNOTED = {c: f"{c} Footnote" for c in ["PSI 90 Composite Value", *HAC_SIR_COLS]}


# ---------------------------------------------------------------- rules

def generic_rules(v: Validator, ds: dict, df: pd.DataFrame) -> None:
    i = ds["id"]
    # required columns
    missing = [c for c in ds["expected_columns"] if c not in df.columns]
    v.add(f"{i}.columns", i, f"All {len(ds['expected_columns'])} expected columns present"
          + (f" (missing: {', '.join(missing[:5])})" if missing else ""), "error", len(ds["expected_columns"]),
          len(missing))
    if missing:
        return

    # CCN format (text, 6 chars incl. leading zeros)
    ccn_col = ds.get("ccn_column")
    if ccn_col:
        bad = ~df[ccn_col].str.strip().str.match(CCN_RE)
        v.add(f"{i}.ccn_format", i, f"'{ccn_col}' is a 6-character CCN string (leading zeros kept)", "error",
              len(df), bad.sum())

    # unique key per grain
    key = ds.get("key") or []
    if key:
        dup = df.duplicated(subset=key, keep=False)
        # cost report: hospitals can file >1 report in a year (CHOW, short periods) -> transform dedupes
        sev = "warn" if i == "cost_report" else "error"
        v.add(f"{i}.unique_key", i, f"No duplicate rows per ({', '.join(key)})", sev, len(df), dup.sum())

    # missing markers (info) + numeric parse rate
    cols = [c for c in VALUE_COLUMNS.get(i, []) if c in df.columns]
    if cols:
        total = len(df) * len(cols)
        n_missing = sum((~present(df[c])).sum() for c in cols)
        v.add(f"{i}.missing_markers", i, "Values reported as 'Not Available' / 'N/A' / 'Not Applicable' / blank "
              f"in {', '.join(cols[:3])}{'…' if len(cols) > 3 else ''}", "info", total, n_missing)
        unparsed = 0
        checked = 0
        for c in cols:
            p = present(df[c])
            vals = df.loc[p, c]
            checked += len(vals)
            unparsed += numeric(vals).isna().sum()
        v.add(f"{i}.numeric_parse", i, "Non-missing value cells parse as numbers", "warn", checked, unparsed)

    # dates
    for col in ds.get("period_columns", []):
        if col not in df.columns:
            continue
        p = df[col].str.strip() != ""
        vals = df.loc[p, col].str.strip()
        ok = vals.str.match(DATE_RE) & pd.to_datetime(vals, format="%m/%d/%Y", errors="coerce").notna()
        v.add(f"{i}.date_format.{col.lower().replace(' ', '_')}", i, f"'{col}' parses as MM/DD/YYYY", "error",
              len(vals), (~ok).sum())


def hai_rules(v: Validator, df: pd.DataFrame) -> None:
    i = "77hc-ibv8"
    sir = df[df["Measure ID"].str.endswith("_SIR")]
    x = numeric(sir["Score"])
    v.add(f"{i}.sir_nonnegative", i, "HAI SIR values are ≥ 0", "error", x.notna().sum(), (x < 0).sum())
    for suffix, label in [("_NUMERATOR", "observed"), ("_ELIGCASES", "predicted"), ("_DOPC", "device/patient days")]:
        x = numeric(df.loc[df["Measure ID"].str.endswith(suffix), "Score"])
        v.add(f"{i}{suffix.lower()}_nonnegative", i, f"HAI {label} counts ({suffix[1:]}) are ≥ 0", "error",
              x.notna().sum(), (x < 0).sum())
    obs = df[df["Measure ID"].str.endswith("_NUMERATOR")]
    xo = numeric(obs["Score"])
    v.add(f"{i}.observed_integer", i, "HAI observed counts are whole numbers", "warn", xo.notna().sum(),
          (xo.notna() & (xo % 1 != 0)).sum())
    fn = sir["Footnote"].str.strip() != ""
    v.add(f"{i}.footnoted_numeric", i, "SIR rows that are numeric AND carry a footnote (kept, flagged)", "info",
          len(sir), (fn & numeric(sir["Score"]).notna()).sum())
    n_periods = df[["Start Date", "End Date"]].drop_duplicates().shape[0]
    v.add(f"{i}.single_period", i, "All HAI rows share one reporting period", "warn", 1, int(n_periods != 1))
    expected = {f"HAI_{n}_{s}" for n in range(1, 7)
                for s in ("SIR", "NUMERATOR", "ELIGCASES", "DOPC", "CILOWER", "CIUPPER")}
    got = set(df["Measure ID"].unique())
    v.add(f"{i}.measure_ids", i, "Measure IDs are exactly HAI_1..HAI_6 × {SIR, NUMERATOR, ELIGCASES, DOPC, "
          "CILOWER, CIUPPER}", "error", len(expected), len(expected ^ got))


def hac_rules(v: Validator, df: pd.DataFrame, general: pd.DataFrame | None, cost: pd.DataFrame | None,
              inpatient: pd.DataFrame | None) -> None:
    i = "yq43-i98g"
    v.add(f"{i}.row_count", i, "HAC file has more than 2,500 hospitals", "error", len(df), int(len(df) <= 2500))
    for c in HAC_SIR_COLS:
        x = numeric(df[c])
        v.add(f"{i}.{c.split()[0].lower()}_sir_nonnegative", i, f"{c} is ≥ 0", "error", x.notna().sum(),
              (x < 0).sum())
    zs = pd.concat([numeric(df[c]) for c in HAC_Z_COLS])
    v.add(f"{i}.z_range", i, "Winsorized z-scores fall within ±10", "warn", zs.notna().sum(), (zs.abs() > 10).sum())

    pr = df["Payment Reduction"].str.strip()
    prf = df["Payment Reduction Footnote"].str.strip()
    allowed = pr.isin({"Yes", "No", "N/A"}) | ((pr == "") & (prf != ""))
    v.add(f"{i}.payment_reduction_values", i, "Payment Reduction is Yes / No / N/A (blank only when footnoted)",
          "error", len(df), (~allowed).sum())
    v.add(f"{i}.payment_reduction_not_applicable", i, "Hospitals whose payment-reduction flag is N/A or blank "
          "(footnote 'a' = Maryland, exempt from the payment reduction)", "info", len(df),
          (pr.isin({"N/A", ""})).sum())
    total = numeric(df["Total HAC Score"])
    v.add(f"{i}.total_without_flag", i, "Hospitals with a Total HAC Score but no Yes/No flag", "info",
          total.notna().sum(), (total.notna() & ~pr.isin({"Yes", "No"})).sum())

    footnoted = 0
    checked = 0
    for c, fc in HAC_FOOTNOTED.items():
        x = numeric(df[c])
        checked += x.notna().sum()
        footnoted += (x.notna() & (df[fc].str.strip() != "")).sum()
    v.add(f"{i}.footnoted_numeric", i, "Measure values that are numeric AND footnoted (e.g. SIR 0.000 with "
          "footnote 29); kept as values, footnote shown in UI", "info", checked, footnoted)

    ccns = set(df["Facility ID"].str.strip())
    if general is not None:
        gen = set(general["Facility ID"].str.strip())
        v.add(f"{i}.join_general_info", i, "HAC CCNs found in Hospital General Information (xubh-q36u)", "warn",
              len(ccns), len(ccns - gen))
    if cost is not None:
        cr = set(cost["Provider CCN"].str.strip())
        v.add(f"{i}.join_cost_report", i, "HAC CCNs matched to the Hospital Provider Cost Report (peer groups)",
              "warn", len(ccns), len(ccns - cr), passed=len(ccns - cr) / max(1, len(ccns)) < 0.05)
    if inpatient is not None:
        mi = set(inpatient["Rndrng_Prvdr_CCN"].str.strip())
        v.add(f"{i}.join_medicare_inpatient", i, "HAC CCNs matched to Medicare Inpatient by Provider (dollar "
              "exposure)", "info", len(ccns), len(ccns - mi))


def general_rules(v: Validator, general: pd.DataFrame, cost: pd.DataFrame | None) -> None:
    i = "xubh-q36u"
    r = general["Hospital overall rating"].str.strip()
    ok = r.isin({"1", "2", "3", "4", "5"}) | ~present(r)
    v.add(f"{i}.star_rating_range", i, "Overall star rating is 1–5 or Not Available", "error", len(r), (~ok).sum())
    if cost is not None:
        ccns = set(general["Facility ID"].str.strip())
        cr = set(cost["Provider CCN"].str.strip())
        v.add(f"{i}.join_cost_report", i, "General-info facilities matched to the Hospital Provider Cost Report",
              "info", len(ccns), len(ccns - cr))


def pct_rule(v: Validator, i: str, df: pd.DataFrame, col: str) -> None:
    x = numeric(df[col])
    v.add(f"{i}.pct_range", i, f"'{col}' is within 0–100", "error", x.notna().sum(), ((x < 0) | (x > 100)).sum())


def hcahps_rules(v: Validator, df: pd.DataFrame) -> None:
    i = "dgck-syfz"
    pct_rule(v, i, df, "HCAHPS Answer Percent")
    star = numeric(df["Patient Survey Star Rating"])
    v.add(f"{i}.star_range", i, "HCAHPS star ratings are 1–5", "error", star.notna().sum(),
          ((star < 1) | (star > 5)).sum())
    has = set(df["HCAHPS Measure ID"].unique())
    need = {"H_COMP_1_A_P", "H_NURSE_RESPECT_A_P", "H_NURSE_LISTEN_A_P", "H_NURSE_EXPLAIN_A_P", "H_COMP_6_Y_P"}
    v.add(f"{i}.nursing_measures_present", i, "Nurse-communication and discharge-info measure IDs are present",
          "error", len(need), len(need - has))


def hrrp_rules(v: Validator, df: pd.DataFrame) -> None:
    i = "9n3s-kdb3"
    x = numeric(df["Excess Readmission Ratio"])
    v.add(f"{i}.err_positive", i, "Excess Readmission Ratio is > 0 and < 5", "error", x.notna().sum(),
          ((x <= 0) | (x >= 5)).sum())


def vbp_rules(v: Validator, df: pd.DataFrame) -> None:
    pct_rule(v, "ypbt-wvdk", df, "Total Performance Score")


def cost_rules(v: Validator, df: pd.DataFrame) -> None:
    i = "cost_report"
    beds = numeric(df["Number of Beds"])
    v.add(f"{i}.beds_positive", i, "Number of Beds is > 0 when reported", "warn", beds.notna().sum(),
          (beds <= 0).sum())
    fte = numeric(df["Number of Interns and Residents (FTE)"])
    v.add(f"{i}.resident_fte_nonnegative", i, "Intern/resident FTE is ≥ 0 when reported", "error",
          fte.notna().sum(), (fte < 0).sum())
    ru = df["Rural Versus Urban"].str.strip()
    v.add(f"{i}.urban_rural_values", i, "Rural Versus Urban is U or R (blank or NA allowed)", "error", len(ru),
          (~ru.isin({"U", "R", "", "NA"})).sum())


def inpatient_rules(v: Validator, df: pd.DataFrame) -> None:
    i = "medicare_inpatient"
    x = numeric(df["Tot_Mdcr_Pymt_Amt"])
    v.add(f"{i}.payments_nonnegative", i, "Total Medicare payment amount is ≥ 0", "error", x.notna().sum(),
          (x < 0).sum())


# ---------------------------------------------------------------- main

def run() -> Validator:
    datasets = yaml.safe_load(CONFIG.read_text())["datasets"]
    v = Validator()
    frames: dict[str, pd.DataFrame] = {}
    for ds in datasets:
        path = RAW / ds["file"]
        if not path.exists():
            v.add(f"{ds['id']}.file_present", ds["id"], f"Raw file {ds['file']} exists", "error", 1, 1)
            continue
        df = read_raw(path)
        frames[ds["id"]] = df
        v.add(f"{ds['id']}.non_empty", ds["id"], "File has at least one data row", "error", 1, int(len(df) == 0))
        generic_rules(v, ds, df)

    g, c, m = frames.get("xubh-q36u"), frames.get("cost_report"), frames.get("medicare_inpatient")
    if "77hc-ibv8" in frames:
        hai_rules(v, frames["77hc-ibv8"])
    if "yq43-i98g" in frames:
        hac_rules(v, frames["yq43-i98g"], g, c, m)
    if g is not None:
        general_rules(v, g, c)
    if "dgck-syfz" in frames:
        hcahps_rules(v, frames["dgck-syfz"])
    for i in ("99ue-w85f", "84jm-wiui"):
        if i in frames:
            pct_rule(v, i, frames[i], "HCAHPS Answer Percent")
    if "9n3s-kdb3" in frames:
        hrrp_rules(v, frames["9n3s-kdb3"])
    if "ypbt-wvdk" in frames:
        vbp_rules(v, frames["ypbt-wvdk"])
    if c is not None:
        cost_rules(v, c)
    if m is not None:
        inpatient_rules(v, m)
    return v


def write(v: Validator) -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    rows = [asdict(r) for r in v.rules]
    pd.DataFrame(rows).to_csv(PROCESSED / "dq_log.csv", index=False)
    built = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    (SITE_DATA / "dq.json").write_text(json.dumps({"built_at": built, "rules": rows}, indent=1) + "\n")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    v = run()
    write(v)
    n_warn = sum(1 for r in v.rules if r.severity == "warn" and not r.passed)
    log.info("%d rules: %d passed, %d warnings, %d errors", len(v.rules), sum(r.passed for r in v.rules), n_warn,
             len(v.errors))
    for r in v.rules:
        if not r.passed:
            log.log(logging.ERROR if r.severity == "error" else logging.WARNING, "%s [%s] %s — %d/%d failed",
                    r.rule_id, r.severity, r.description, r.failed, r.checked)
    return 1 if v.errors else 0


if __name__ == "__main__":
    sys.exit(main())
