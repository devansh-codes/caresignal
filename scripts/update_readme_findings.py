"""Fill the README's <!-- FINDINGS:START/END --> block from web/public/data/national.json.

Every number comes from the exported national insights (which carry their own source file and period),
so the README never holds hand-typed figures. Run after `pipeline.export_site`.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
NATIONAL = ROOT / "web" / "public" / "data" / "national.json"
START, END = "<!-- FINDINGS:START -->", "<!-- FINDINGS:END -->"


def render(nat: dict) -> str:
    c = nat["counts"]
    fy = nat["hac_params"]["fiscal_year"]
    lines = [
        f"_Worked out by the pipeline from public CMS files (built {nat['built_at'][:10]}). "
        "Each finding names its source file and time period._",
        "",
        f"- **{c['hac_scored']:,}** of {c['facilities']:,} hospitals have a FY{fy} safety score (Total HAC Score). "
        f"The penalty line is a score above **{nat['hac_params']['cutoff']:.5f}** (`yq43-i98g`).",
    ]
    for i in nat["insights"]:
        lines.append(f"- **{i['title']}** ({i['value']}). {i['detail']}  ")
        lines.append(f"  <sub>Source: {i['source']}. {i['period']}</sub>")
    return "\n".join(lines)


def main() -> None:
    if not NATIONAL.exists():
        sys.exit(f"{NATIONAL} not found; run the pipeline first")
    text = README.read_text()
    if START not in text or END not in text:
        sys.exit("README is missing the FINDINGS markers")
    block = render(json.loads(NATIONAL.read_text()))
    new = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: f"{START}\n{block}\n{END}", text, flags=re.S)
    README.write_text(new)
    print(f"README findings updated ({block.count(chr(10)) + 1} lines)")


if __name__ == "__main__":
    main()
