"""Transform raw CMS CSVs into tidy processed tables (data/processed/*.parquet).

All business logic lives in pipeline/sql/*.sql (DuckDB). This module registers each raw file as a
VARCHAR-only view, runs the SQL files in order, and writes one parquet per output table.

Run: python -m pipeline.transform
"""

from __future__ import annotations

import sys

import duckdb

from pipeline.common import CENSUS_REGION, HAI_KEYS, NA_STRINGS, PROCESSED, RAW, SQL_DIR

# view name -> raw file stem (see docs/CONTRACTS.md "Raw dataset IDs")
RAW_VIEWS = {
    "raw_general": "xubh-q36u",
    "raw_hai": "77hc-ibv8",
    "raw_hcahps": "dgck-syfz",
    "raw_complications": "ynj2-r877",
    "raw_psi_six": "muwa-iene",
    "raw_hrrp": "9n3s-kdb3",
    "raw_vbp": "ypbt-wvdk",
    "raw_unplanned": "632h-zaca",
    "raw_timely": "yv7e-xc69",
    "raw_hcahps_national": "99ue-w85f",
    "raw_hcahps_state": "84jm-wiui",
    "raw_cost_report": "cost_report",
    "raw_medicare_inpatient": "medicare_inpatient",
}

# output table -> (natural key columns), checked for uniqueness before writing
OUTPUTS = {
    "hospitals": ["ccn"],
    "hai": ["ccn", "key"],
    "hcahps": ["ccn", "measure_id"],
    "hcahps_benchmarks": ["level", "measure_id"],
    "psi": ["ccn", "measure_id"],
    "hrrp": ["ccn", "condition"],
    "vbp": ["ccn"],
    "timely_care": ["ccn", "measure_id"],
    "unplanned_visits": ["ccn", "measure_id"],
}


def _sql_literal(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    missing = [stem for stem in RAW_VIEWS.values() if not (RAW / f"{stem}.csv").exists()]
    if missing:
        sys.exit(f"transform: missing raw files: {', '.join(missing)} (run pipeline.fetch first)")
    for view, stem in RAW_VIEWS.items():
        path = (RAW / f"{stem}.csv").as_posix()
        con.execute(
            f"CREATE OR REPLACE VIEW {view} AS SELECT * FROM read_csv("
            f"{_sql_literal(path)}, all_varchar=true, header=true, auto_detect=true)"
        )
    con.execute("CREATE OR REPLACE TABLE census_regions (state VARCHAR, region VARCHAR)")
    con.executemany("INSERT INTO census_regions VALUES (?, ?)", list(CENSUS_REGION.items()))
    con.execute("CREATE OR REPLACE TABLE hai_keys (hai_id VARCHAR, key VARCHAR)")
    con.executemany("INSERT INTO hai_keys VALUES (?, ?)", list(HAI_KEYS.items()))
    return con


def run_sql(con: duckdb.DuckDBPyConnection) -> None:
    na_list = ", ".join(_sql_literal(s) for s in sorted(NA_STRINGS))
    for path in sorted(SQL_DIR.glob("*.sql")):
        con.execute(path.read_text().replace("{NA_LIST}", na_list))


def check_grain(con: duckdb.DuckDBPyConnection, table: str, keys: list[str]) -> None:
    cols = ", ".join(keys)
    dupes = con.execute(
        f"SELECT count(*) FROM (SELECT {cols} FROM {table} GROUP BY {cols} HAVING count(*) > 1)"
    ).fetchone()[0]
    if dupes:
        raise ValueError(f"{table}: {dupes} duplicate keys on ({cols})")


def coverage(con: duckdb.DuckDBPyConnection, column: str) -> float:
    n, hit = con.execute(f"SELECT count(*), count({column}) FROM hospitals").fetchone()
    return hit / n if n else 0.0


def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    con = connect()
    run_sql(con)
    print("transform: wrote")
    for table, keys in OUTPUTS.items():
        check_grain(con, table, keys)
        out = (PROCESSED / f"{table}.parquet").as_posix()
        con.execute(f"COPY {table} TO {_sql_literal(out)} (FORMAT PARQUET)")
        n = con.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        print(f"  {table:<18} {n:>8,} rows")
    print(
        "transform: join coverage of hospitals — "
        f"cost report {coverage(con, 'beds'):.1%}, "
        f"medicare inpatient {coverage(con, 'medicare_payments'):.1%}, "
        f"census region {coverage(con, 'census_region'):.1%}"
    )


if __name__ == "__main__":
    main()
