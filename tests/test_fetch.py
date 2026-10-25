"""Unit tests for pipeline.fetch: retries, URL resolution and change detection (no network)."""
import json

import pytest
import requests

from pipeline import fetch


class FakeResp:
    def __init__(self, status=200, payload=None, body=b"a,b\n1,2\n"):
        self.status_code = status
        self._payload = payload
        self._body = body

    def json(self):
        return self._payload

    def iter_content(self, n):
        yield self._body


class FakeSession:
    """Returns queued responses (or raises queued exceptions) in order, recording URLs."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.urls = []

    def get(self, url, **kw):
        self.urls.append(url)
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def test_http_get_retries_5xx_then_succeeds():
    s = FakeSession([FakeResp(503), requests.ConnectionError("reset"), FakeResp(200, {"ok": 1})])
    sleeps = []
    r = fetch.http_get("https://x.test/a", session=s, sleep=sleeps.append, backoff=1)
    assert r.json() == {"ok": 1}
    assert sleeps == [1, 2]  # exponential backoff


def test_http_get_fails_fast_on_404():
    s = FakeSession([FakeResp(404)])
    with pytest.raises(fetch.FetchError, match="404"):
        fetch.http_get("https://x.test/a", session=s, sleep=lambda _: None)
    assert len(s.urls) == 1


def test_http_get_gives_up_after_retries():
    s = FakeSession([FakeResp(500)] * 3)
    with pytest.raises(fetch.FetchError, match="giving up"):
        fetch.http_get("https://x.test/a", session=s, retries=3, sleep=lambda _: None)


def test_resolve_pdc_reads_distribution_download_url():
    meta = {"title": "HAC", "modified": "2026-01-26",
            "distribution": [{"downloadURL": "https://data.cms.gov/x/FY_2026_HAC.csv"}]}
    s = FakeSession([FakeResp(200, meta)])
    info = fetch.resolve_pdc("yq43-i98g", session=s)
    assert info == {"download_url": "https://data.cms.gov/x/FY_2026_HAC.csv", "modified": "2026-01-26", "title": "HAC"}
    assert s.urls[0].endswith("/items/yq43-i98g")


def test_resolve_pdc_without_distribution_errors():
    s = FakeSession([FakeResp(200, {"title": "x", "distribution": []})])
    with pytest.raises(fetch.FetchError):
        fetch.resolve_pdc("abcd-1234", session=s)


def test_datacms_candidates_newest_first_and_exact_title():
    catalog = {"dataset": [
        {"title": "Medicare Inpatient Hospitals - by Provider : 2023-12-01", "modified": "m23",
         "distribution": [{"format": "API", "accessURL": "api"},
                          {"mediaType": "text/csv", "downloadURL": "https://d/23.csv"}]},
        {"title": "Medicare Inpatient Hospitals - by Provider : 2024-01-01", "modified": "m24",
         "distribution": [{"mediaType": "text/csv", "downloadURL": "https://d/24.csv"}]},
        {"title": "Medicare Inpatient Hospitals - by Provider and Service : 2024-01-01",
         "distribution": [{"mediaType": "text/csv", "downloadURL": "https://d/svc.csv"}]},
        {"title": "Medicare Inpatient Hospitals - by Provider : 2025-01-01", "distribution": [{"format": "API"}]},
    ]}
    c = fetch.datacms_candidates(catalog, "Medicare Inpatient Hospitals - by Provider")
    assert [x["year"] for x in c] == [2024, 2023]
    assert c[0]["download_url"] == "https://d/24.csv"


def test_scan_csv_period_and_rows(tmp_path):
    p = tmp_path / "f.csv"
    p.write_text('"Facility ID","Start Date","End Date"\n"010001","01/01/2023","12/31/2024"\n'
                 '"010005","07/01/2022","06/30/2024"\n')
    s = fetch.scan_csv(p, ["Start Date", "End Date"], "Facility ID")
    assert s["rows"] == 2
    assert s["period"] == {"start": "2022-07-01", "end": "2024-12-31"}
    assert s["ccns"] == {"010001", "010005"}  # leading zeros kept


def test_to_iso():
    assert fetch.to_iso("07/01/2022") == "2022-07-01"
    assert fetch.to_iso("N/A") is None


def test_if_changed_skips_unchanged(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch, "RAW", tmp_path)
    dest = tmp_path / "abcd-1234.csv"
    dest.write_text("a\n1\n")
    prev = {"id": "abcd-1234", "modified": "2026-07-22", "sha256": fetch.sha256_of(dest), "rows": 1}
    monkeypatch.setattr(fetch, "resolve_pdc", lambda i, session=None: {
        "download_url": "https://new", "modified": "2026-07-22", "title": "t"})
    monkeypatch.setattr(fetch, "download", lambda *a, **k: pytest.fail("should not download"))
    ds = {"id": "abcd-1234", "file": "abcd-1234.csv", "title": "t", "role": "r", "period_columns": []}
    e = fetch.fetch_pdc(ds, prev, if_changed=True)
    assert e["skipped"] is True


def test_manifest_written_with_contract_shape(tmp_path, monkeypatch):
    """--offline rebuilds a manifest whose entries match the SourceEntry shape in web/src/lib/types.ts."""
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "abcd-1234.csv").write_text('"Facility ID","Start Date","End Date"\n"010001","01/01/2023","12/31/2024"\n')
    cfg = tmp_path / "datasets.yaml"
    cfg.write_text("datasets:\n- id: abcd-1234\n  source: pdc\n  title: T\n  role: R\n  file: abcd-1234.csv\n"
                   "  period_columns: [Start Date, End Date]\n  expected_columns: [Facility ID]\n")
    monkeypatch.setattr(fetch, "RAW", raw)
    monkeypatch.setattr(fetch, "CONFIG", cfg)
    monkeypatch.setattr(fetch, "SNAPSHOTS", tmp_path / "snap")
    monkeypatch.setattr(fetch, "load_config", lambda path=cfg: fetch.yaml.safe_load(cfg.read_text())["datasets"])
    m = fetch.run(offline=True)
    on_disk = json.loads((raw / "manifest.json").read_text())
    assert on_disk["sources"] == m["sources"]
    e = m["sources"][0]
    for k in ("id", "title", "role", "modified", "download_url", "rows", "period", "http_status", "sha256",
              "fetched_at"):
        assert k in e
    assert e["period"] == {"start": "2023-01-01", "end": "2024-12-31"}
    assert any((tmp_path / "snap").glob("*/manifest.json"))
