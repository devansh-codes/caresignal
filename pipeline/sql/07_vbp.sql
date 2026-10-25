-- Hospital VBP Total Performance Score and domain scores.
CREATE OR REPLACE TABLE vbp AS
SELECT
    ccn("Facility ID")                                                   AS ccn,
    TRY_CAST(na("Fiscal Year") AS INTEGER)                               AS fiscal_year,
    num("Weighted Normalized Clinical Outcomes Domain Score")            AS clinical_w,
    num("Weighted Person And Community Engagement Domain Score")         AS engagement_w,
    num("Weighted Safety Domain Score")                                  AS safety_w,
    num("Weighted Efficiency And Cost Reduction Domain Score")           AS efficiency_w,
    num("Unweighted Normalized Clinical Outcomes Domain Score")          AS clinical_u,
    num("Unweighted Person And Community Engagement Domain Score")       AS engagement_u,
    num("Unweighted Normalized Safety Domain Score")                     AS safety_u,
    num("Unweighted Normalized Efficiency And Cost Reduction Domain Score") AS efficiency_u,
    num("Total Performance Score")                                       AS tps
FROM raw_vbp
ORDER BY ccn;
