"""Fetch every CareSignal source from CMS and write data/raw/manifest.json.

PDC sources:      metastore item -> distribution[0].downloadURL (never hard-code the CSV URL).
data.cms.gov:     https://data.cms.gov/data.json -> title match -> newest-year CSV distribution.

Usage:
    python -m pipeline.fetch               # download everything
    python -m pipeline.fetch --if-changed  # skip files whose CMS 'modified' + sha256 are unchanged
    python -m pipeline.fetch --offline     # rebuild the manifest from files already in data/raw
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import UTC, date, datetime
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "datasets.yaml"
RAW = ROOT / "data" / "raw"
SNAPSHOTS = ROOT / "data" / "snapshots"

METASTORE = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/{id}"
DATA_JSON = "https://data.cms.gov/data.json"
USER_AGENT = "CareSignal/1.0 (+https://github.com/devansh-codes/caresignal)"

log = logging.getLogger("fetch")


class FetchError(RuntimeError):
    pass


# ---------------------------------------------------------------- HTTP

def http_get(url: str, *, session: requests.Session | None = None, retries: int = 5,
             backoff: float = 2.0, stream: bool = False, timeout: float = 120.0,
             sleep=time.sleep) -> requests.Response:
    """GET with exponential backoff on network errors, 429 and 5xx. 4xx (other than 429) fails fast."""
    s = session or requests
    last: Exception | None = None
    for attempt in range(retries):
        try:
            r = s.get(url, stream=stream, timeout=timeout, headers={"User-Agent": USER_AGENT})
            if r.status_code == 200:
                return r
            if r.status_code == 429 or r.status_code >= 500:
                last = FetchError(f"HTTP {r.status_code} for {url}")
            else:
                raise FetchError(f"HTTP {r.status_code} for {url}")
        except requests.RequestException as e:  # connection reset, timeout, ...
            last = e
        if attempt < retries - 1:
            wait = backoff * (2 ** attempt)
            log.warning("retry %d/%d in %.0fs: %s", attempt + 1, retries - 1, wait, last)
            sleep(wait)
    raise FetchError(f"giving up on {url}: {last}")


# ---------------------------------------------------------------- URL resolution

def resolve_pdc(dataset_id: str, session=None) -> dict:
    """Return {download_url, modified, title} from the PDC metastore."""
    meta = http_get(METASTORE.format(id=dataset_id), session=session, timeout=60).json()
    dist = meta.get("distribution") or []
    if not dist or not dist[0].get("downloadURL"):
        raise FetchError(f"{dataset_id}: metastore has no distribution[0].downloadURL")
    return {"download_url": dist[0]["downloadURL"], "modified": meta.get("modified"), "title": meta.get("title")}


_YEAR_RE = re.compile(r":\s*(\d{4})-\d{2}-\d{2}")


def datacms_candidates(catalog: dict, title_match: str) -> list[dict]:
    """All yearly CSV distributions for a data.cms.gov dataset title, newest year first.

    data.json lists each year as a separate dataset titled '<title> : YYYY-MM-DD'.
    """
    out = []
    for ds in catalog.get("dataset", []):
        title = ds.get("title", "")
        if not title.startswith(title_match):
            continue
        rest = title[len(title_match):]
        if rest and not rest.lstrip().startswith(":"):
            continue  # e.g. '... by Provider and Service' when matching '... by Provider'
        m = _YEAR_RE.search(rest)
        if not m:
            continue
        csvs = [d for d in ds.get("distribution", [])
                if (d.get("mediaType") == "text/csv" or d.get("format") == "CSV") and d.get("downloadURL")]
        if not csvs:
            continue
        out.append({"year": int(m.group(1)), "title": title, "download_url": csvs[0]["downloadURL"],
                    "modified": ds.get("modified")})
    out.sort(key=lambda c: c["year"], reverse=True)
    return out


# ---------------------------------------------------------------- file helpers

def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path, session=None) -> int:
    """Stream to a temp file, then atomically replace dest. Returns the HTTP status."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = http_get(url, session=session, stream=True, timeout=600)
    fd, tmp = tempfile.mkstemp(dir=dest.parent, suffix=".part")
    try:
        with os.fdopen(fd, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
        if os.path.getsize(tmp) == 0:
            raise FetchError(f"empty download from {url}")
        os.replace(tmp, dest)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    return r.status_code


def open_csv(path: Path):
    """CMS files are UTF-8 (sometimes with BOM); a few data.cms.gov files are Latin-1."""
    try:
        with open(path, encoding="utf-8-sig") as f:
            f.read(1 << 20)
        return open(path, encoding="utf-8-sig", newline="")
    except UnicodeDecodeError:
        return open(path, encoding="latin-1", newline="")


def to_iso(s: str | None) -> str | None:
    s = (s or "").strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def scan_csv(path: Path, period_columns: list[str], ccn_column: str | None = None) -> dict:
    """Row count, ISO period (min of start-ish columns, max of end-ish columns), distinct CCNs."""
    rows = 0
    starts: list[str] = []
    ends: list[str] = []
    ccns: set[str] = set()
    with open_csv(path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows += 1
            for col in period_columns:
                iso = to_iso(row.get(col))
                if iso:
                    (ends if ("End" in col) else starts).append(iso)
            if ccn_column:
                ccns.add((row.get(ccn_column) or "").strip())
    period = None
    if starts or ends:
        period = {"start": min(starts) if starts else None, "end": max(ends) if ends else None}
    return {"rows": rows, "period": period, "ccns": ccns}


def git_sha() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short=7", "HEAD"], cwd=ROOT,
                                       stderr=subprocess.DEVNULL, text=True).strip() or None
    except Exception:
        return None


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- per-source

def load_config(path: Path = CONFIG) -> list[dict]:
    return yaml.safe_load(path.read_text())["datasets"]


def load_manifest(path: Path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            pass
    return {"sources": []}


def entry_for(ds: dict, dest: Path, *, download_url: str, modified: str | None, http_status: int,
              fetched_at: str, extra: dict | None = None, scan: dict | None = None) -> dict:
    scan = scan or scan_csv(dest, ds.get("period_columns", []))
    e = {
        "id": ds["id"],
        "title": ds["title"],
        "role": ds["role"],
        "modified": modified,
        "download_url": download_url,
        "rows": scan["rows"],
        "period": scan["period"],
        "http_status": http_status,
        "sha256": sha256_of(dest),
        "fetched_at": fetched_at,
    }
    if extra:
        e.update(extra)
    return e


def fetch_pdc(ds: dict, prev: dict | None, *, if_changed: bool, session=None) -> dict:
    dest = RAW / ds["file"]
    info = resolve_pdc(ds["id"], session=session)
    if (if_changed and prev and dest.exists() and prev.get("modified") == info["modified"]
            and prev.get("sha256") == sha256_of(dest)):
        log.info("%s unchanged (modified %s) — skipped", ds["id"], info["modified"])
        return {**prev, "download_url": info["download_url"], "skipped": True}
    status = download(info["download_url"], dest, session=session)
    log.info("%s downloaded (%s)", ds["id"], info["modified"])
    return entry_for(ds, dest, download_url=info["download_url"], modified=info["modified"],
                     http_status=status, fetched_at=now_iso())


def fetch_datacms(ds: dict, prev: dict | None, catalog: dict, *, if_changed: bool, session=None) -> dict:
    dest = RAW / ds["file"]
    cands = datacms_candidates(catalog, ds.get("title_match", ds["title"]))
    if not cands:
        raise FetchError(f"{ds['id']}: no CSV distributions match '{ds['title']}' in data.json")
    newest = cands[0]

    if (if_changed and prev and dest.exists() and prev.get("modified") == newest["modified"]
            and prev.get("year_candidate") == newest["year"] and prev.get("sha256") == sha256_of(dest)):
        log.info("%s unchanged — skipped", ds["id"])
        return {**prev, "skipped": True}

    rule = ds.get("coverage_rule")
    chosen, note = newest, None
    status = download(newest["download_url"], dest, session=session)
    scan = scan_csv(dest, ds.get("period_columns", []), ds.get("ccn_column"))
    if rule and len(cands) > 1:
        prior = cands[1]
        with tempfile.TemporaryDirectory(dir=RAW) as td:
            ptmp = Path(td) / "prior.csv"
            download(prior["download_url"], ptmp, session=session)
            pscan = scan_csv(ptmp, ds.get("period_columns", []), ds.get("ccn_column"))
            ratio = len(scan["ccns"]) / max(1, len(pscan["ccns"]))
            if ratio < rule.get("min_ratio_vs_prior", 0.9):
                note = (f"{newest['year']} covers {len(scan['ccns'])} CCNs = {ratio:.0%} of "
                        f"{prior['year']} ({len(pscan['ccns'])}); using {prior['year']}")
                os.replace(ptmp, dest)
                chosen, scan = prior, pscan
            else:
                note = f"{newest['year']} covers {ratio:.0%} of {prior['year']} CCNs; using {newest['year']}"
    log.info("%s: %s", ds["id"], note or f"using {chosen['year']}")
    return entry_for(ds, dest, download_url=chosen["download_url"], modified=chosen["modified"],
                     http_status=status, fetched_at=now_iso(), scan=scan,
                     extra={"year": chosen["year"], "year_candidate": newest["year"], "selection_note": note})


def offline_entry(ds: dict, prev: dict | None) -> dict:
    dest = RAW / ds["file"]
    if not dest.exists():
        raise FetchError(f"--offline: {dest} is missing")
    prev = prev or {}
    scan = scan_csv(dest, ds.get("period_columns", []))
    e = entry_for(ds, dest, download_url=prev.get("download_url", ""), modified=prev.get("modified"),
                  http_status=prev.get("http_status", 0), fetched_at=prev.get("fetched_at") or now_iso(), scan=scan)
    for k in ("year", "year_candidate", "selection_note"):
        if k in prev:
            e[k] = prev[k]
    return e


# ---------------------------------------------------------------- main

def run(*, if_changed: bool = False, offline: bool = False, only: list[str] | None = None) -> dict:
    RAW.mkdir(parents=True, exist_ok=True)
    manifest_path = RAW / "manifest.json"
    prev_by_id = {s["id"]: s for s in load_manifest(manifest_path).get("sources", [])}
    datasets = [d for d in load_config() if not only or d["id"] in only]
    session = None if offline else requests.Session()
    catalog = None
    sources, failures = [], []

    for ds in datasets:
        prev = prev_by_id.get(ds["id"])
        try:
            if offline:
                e = offline_entry(ds, prev)
            elif ds["source"] == "pdc":
                e = fetch_pdc(ds, prev, if_changed=if_changed, session=session)
            else:
                if catalog is None:
                    catalog = http_get(DATA_JSON, session=session, timeout=300).json()
                e = fetch_datacms(ds, prev, catalog, if_changed=if_changed, session=session)
        except Exception as ex:  # record and fail at the end, so one bad source is visible in the log
            log.error("%s failed: %s", ds["id"], ex)
            failures.append(ds["id"])
            if prev:
                sources.append({**prev, "http_status": getattr(ex, "status", prev.get("http_status", 0)),
                                "error": str(ex)})
            continue
        sources.append(e)

    if only:  # keep untouched sources from the previous manifest
        seen = {s["id"] for s in sources}
        sources += [s for i, s in prev_by_id.items() if i not in seen]

    # 'changed' = content differs from the previous manifest (drives skip-reprocessing in CI)
    changed = [s["id"] for s in sources
               if not s.get("skipped") and s.get("sha256") != prev_by_id.get(s["id"], {}).get("sha256")]
    for s in sources:
        s.pop("skipped", None)
    manifest = {"built_at": now_iso(), "git_sha": git_sha(), "changed": changed, "sources": sources}
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    snap = SNAPSHOTS / date.today().isoformat()
    snap.mkdir(parents=True, exist_ok=True)
    (snap / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    log.info("manifest: %d sources, %d changed, %d failed", len(sources), len(changed), len(failures))
    if failures:
        raise FetchError(f"failed sources: {', '.join(failures)}")
    return manifest


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--if-changed", action="store_true", help="skip files whose modified date and sha256 are unchanged")
    p.add_argument("--offline", action="store_true", help="rebuild manifest from existing files, no network")
    p.add_argument("--only", nargs="*", help="dataset ids to fetch")
    a = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    try:
        run(if_changed=a.if_changed, offline=a.offline, only=a.only)
    except FetchError as e:
        log.error("%s", e)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
