-- Unplanned Hospital Visits: readmission and return-visit measures.
CREATE OR REPLACE TABLE unplanned_visits AS
SELECT
    ccn("Facility ID")           AS ccn,
    "Measure ID"                 AS measure_id,
    na("Measure Name")           AS measure_name,
    na("Compared to National")   AS compared_to_national,
    num("Denominator")           AS denominator,
    num("Score")                 AS score,
    num("Lower Estimate")        AS lower,
    num("Higher Estimate")       AS higher,
    na("Footnote")               AS footnote,
    iso("Start Date")            AS start_date,
    iso("End Date")              AS end_date
FROM raw_unplanned
ORDER BY ccn, measure_id;
