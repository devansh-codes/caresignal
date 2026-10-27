# CareSignal Style and Plain Language Guide

The visual design follows cityhealthdashboard.com. The copy is written for a nurse manager, hospital board member or patient advocate. None of them should need a statistics background.

## Visual system (light theme is the default; dark mode is optional and secondary)

| Token | Value | Use |
|---|---|---|
| navy | `#112659` | Headings, sidebar, primary text accents, dark buttons |
| royal | `#2F4F9E` | Uppercase labels, links, highlight bands ("What's new" style) |
| yellow | `#FECA71` | Primary buttons (navy text), link underlines, focus accents |
| page | `#F5F6FA` | Page background |
| card | `#FFFFFF` | Cards: flat, square corners (2px max), no heavy shadow, generous padding (32px desktop) |
| body text | `#58585A` | Paragraphs |
| rule | `#C9D2E3` | Thin vertical and horizontal dividers, like the reference |
| teal scale | `#E1EEF2 #CFE3EA #B7D3DE #9FC2D1 #87B1C3 #6FA0B5 #5890A8 #3F7F9B #2A6F8F #006A8E` | Sequential charts and maps ("darker = worse") |
| penalty | `#B3261E` | Used only for "above the penalty line" |
| watch | `#A15C00` | "Close to the line" |
| safe | `#2E7D4F` | "Below the line" |

- **Font:** Hanken Grotesk (Google Fonts), a free stand-in for Atlas Grotesk. Headings weigh 600 to 700, body text 400, and big stat numbers 300 to 400 at 56px or larger.
- **Layout:**
  - A white top bar holds the logo with the tagline "Medicare safety penalties, explained" and a yellow "Find a hospital" button on the right.
  - On desktop, a fixed navy left sidebar about 72px wide carries icon and tiny uppercase labels: FIND A HOSPITAL, HOSPITALS, INSIGHTS, HOW IT WORKS, DATA, DOWNLOADS. On mobile, a hamburger opens a drawer.
  - Hero sections pair a big navy heading with a large search box (white, yellow bottom border, magnifier icon).
  - Uppercase royal-blue eyebrow labels have letter spacing.
  - Big numbers sit with small uppercase captions above and below them.
- **Links and buttons:**
  - Text links are navy and bold, with a yellow underline and a right arrow ("Read more →" style).
  - Primary buttons are yellow with navy text and square corners. Secondary buttons are solid navy with white text.
- **Hospital page:** follow the reference city page. An eyebrow reads "HOSPITAL PROFILE", then a big hospital name, then a row of tabs underneath. Long detail lives in gray accordion bars with a "SHOW ⌄" toggle.

## Plain language rules

1. **No dashes in any visible text.** This means no em dash, no en dash, and no hyphen used as punctuation or in compound words. Rewrite the sentence instead: "Nursing driven", "top box score", "30 day readmissions", "one page brief".
   - Dates use "to": "Jul 1, 2022 to Jun 30, 2024".
   - A missing value shows as "N/A", with a tooltip reading "Not reported by CMS".
   - Exceptions: hospital IDs, URLs, file names and the minus sign on a number (e.g. −0.25) stay as they are.
2. Lead with what the reader can act on, then explain it. Use short sentences and everyday words.
3. Introduce every technical term once with its plain meaning, then use the plain name consistently. Write the CMS name in small text where people need to match it to official reports.

| Plain name (use this) | Technical name (small, secondary) |
|---|---|
| Safety score | Total HAC Score |
| Penalty line | 75th percentile cutoff |
| Above the penalty line | Penalized (1% payment reduction) |
| Close to the line | Within 2 infections of crossing |
| Below the line | Not penalized |
| Infection rate vs expected | Standardized Infection Ratio (SIR) |
| Points above or below average | z score |
| Infections to prevent | Patients to prevent |
| Biggest opportunity | Tipping measure |
| Patient safety events | PSI 90 composite |
| Catheter infections | CAUTI |
| Central line infections | CLABSI |
| Surgical site infections | SSI |
| C. diff infections | CDI |
| MRSA bloodstream infections | MRSA bacteremia |
| Nurse communication score | HCAHPS H_COMP_1 top box |
| Similar hospitals | Peer group |
| Readmission ratio | Excess Readmission Ratio (ERR) |
| Money at risk (estimate) | 1% of Medicare inpatient payments |

4. Status labels:
   - "Above the penalty line"
   - "Close to the line"
   - "Below the line"
   - "Exempt (Maryland)"
   - "No safety score"
5. Measure category labels: "Nursing driven", "Shared", "Other".
6. Every chart or number keeps its source line, written plainly: "Source: CMS Hospital Acquired Condition Reduction Program, FY2026 (data from Jul 1, 2022 to Dec 31, 2024)".
7. Each page opens with a short "What this page tells you" line. Workflows are numbered steps (1, 2, 3) written as plain instructions.
