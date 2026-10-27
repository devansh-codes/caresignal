"""Plain-language text helpers (docs/STYLE_GUIDE.md).

Every visible string the pipeline emits avoids em dashes, en dashes and hyphens used as punctuation or in
compound words. Authored copy is written that way directly; `plain()` is the backstop for text that comes
from CMS (hospital names, footnotes, file titles), keeping identifiers such as dataset ids, peer keys,
ISO dates, URLs and file names intact.
"""

from __future__ import annotations

import re
from datetime import date, datetime

MISSING = "N/A"

# Tokens whose hyphens are part of an identifier and must survive untouched.
PROTECTED = re.compile(
    r"https?://\S+"
    r"|\b[a-z0-9]{4}-[a-z0-9]{4}\b"  # CMS dataset ids, e.g. yq43-i98g
    r"|\b\d{4}-\d{2}-\d{2}(?:T[0-9:.+Z-]+)?\b"  # ISO dates and timestamps
    r"|[\w./]+\.(?:csv|json|xlsx|parquet|py|yaml|md)\b"  # file names
    r"|\bb(?:0_99|100_299|300_499|500p)(?:-[a-z]+)+\b"  # peer keys
    r"|\bREADM-30-[A-Z-]+-HRRP\b"  # HRRP measure ids
)
DASHES = re.compile(r"[—–]")
# A hyphen used as punctuation or inside a compound word (after identifiers are removed).
BAD_HYPHEN = re.compile(r"(?<=[A-Za-z0-9 ])-(?=[A-Za-z ])|(?<=[A-Za-z ])-(?=[A-Za-z0-9 ])|(?<=\d)-(?=\d)")


def _protect(s: str) -> tuple[str, list[str]]:
    kept: list[str] = []

    def keep(m: re.Match) -> str:
        kept.append(m.group(0))
        return f"\x00{len(kept) - 1}\x00"

    return PROTECTED.sub(keep, s), kept


def _restore(s: str, kept: list[str]) -> str:
    return re.sub(r"\x00(\d+)\x00", lambda m: kept[int(m.group(1))], s)


def plain(s):
    """Rewrite dashes out of a string. Non-strings pass through unchanged."""
    if not isinstance(s, str) or not s:
        return s
    if s.strip() in {"—", "–", "-"}:
        return MISSING
    t, kept = _protect(s)
    t = re.sub(r"(?<![\d.])(\d{1,3})\s*[–—-]\s*(\d{1,3})(?![\d.])", r"\1 to \2", t)  # ranges: 9–10, 100–299
    t = re.sub(r"(?<![\w.])-(?=\d)", "\u2212", t)  # a negative number keeps a true minus sign
    t = re.sub(r"\s*[—–]\s*", ", ", t)  # em/en dash as punctuation
    t = re.sub(r"\s+-\s+", ", ", t)  # spaced hyphen as punctuation
    t = re.sub(r"\b([Nn])on-(?=[a-z])", r"\1on", t)  # non-profit -> nonprofit
    t = re.sub(r"(?<=[A-Za-z])-\s+", " ", t)  # "CENTER- COLLEGE"
    t = re.sub(r"\s+-(?=[A-Za-z])", " ", t)
    t = re.sub(r"(?<=[A-Za-z0-9])-(?=[A-Za-z0-9])", " ", t)  # compound words, SEP-1, Wright-Patterson
    t = re.sub(r"^\s*,\s*", "", t)
    t = re.sub(r"\s*,(\s*,)+", ",", t)
    t = re.sub(r"\s+,", ",", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    return _restore(t, kept)


# Values under these keys are identifiers or machine codes, never shown as prose; every other string in
# exported JSON goes through plain().
ID_KEYS = {
    "ccn", "key", "id", "peer", "rule_id", "dataset", "download_url", "sha256", "measure", "tipping_measure",
    "condition", "status", "category", "direction", "teaching", "urban_rural", "bed_band", "region", "hospitals",
    "git_sha", "fetched_at", "built_at", "modified", "start", "end", "method", "severity", "field", "cutoff_method",
    "zip",
}


def plain_tree(obj, key=None):
    """plain() applied to every string in a JSON-like structure, except values under ID_KEYS."""
    if isinstance(obj, dict):
        return {k: plain_tree(v, k) for k, v in obj.items()}
    if isinstance(obj, list | tuple):
        return [plain_tree(v, key) for v in obj]
    if isinstance(obj, str) and key not in ID_KEYS:
        return plain(obj)
    return obj


def offending(s: str) -> list[str]:
    """Dash characters left in a visible string, after identifiers are set aside (used by tests)."""
    if not isinstance(s, str):
        return []
    t, _ = _protect(s)
    return DASHES.findall(t) + BAD_HYPHEN.findall(t)


def human_date(v) -> str:
    """'Jul 1, 2022' from an ISO string, date or MM/DD/YYYY text."""
    if v is None:
        return MISSING
    if isinstance(v, date | datetime):
        d = v
    else:
        s = str(v)[:10]
        try:
            d = datetime.strptime(s, "%Y-%m-%d")
        except ValueError:
            try:
                d = datetime.strptime(s, "%m/%d/%Y")
            except ValueError:
                return plain(str(v))
    return f"{d.strftime('%b')} {d.day}, {d.year}"


def human_period(start, end) -> str:
    """'Jul 1, 2022 to Jun 30, 2024'."""
    return f"{human_date(start)} to {human_date(end)}"
