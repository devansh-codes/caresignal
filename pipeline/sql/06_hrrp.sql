-- HRRP excess readmission ratios, one row per facility x condition.
CREATE OR REPLACE TABLE hrrp AS
SELECT
    ccn("Facility ID")                                              AS ccn,
    regexp_replace(regexp_replace("Measure Name", '^READM-30-', ''), '-HRRP$', '') AS condition,
    "Measure Name"                                                  AS measure_name,
    int_("Number of Discharges")                                    AS discharges,
    num("Excess Readmission Ratio")                                 AS err,
    num("Predicted Readmission Rate")                               AS predicted_rate,
    num("Expected Readmission Rate")                                AS expected_rate,
    -- Text on purpose: CMS reports small counts as 'Too Few to Report'.
    CASE WHEN trim("Number of Readmissions") IN ('', 'N/A') THEN NULL ELSE trim("Number of Readmissions") END AS readmissions,
    na("Footnote")                                                  AS footnote,
    iso("Start Date")                                               AS start_date,
    iso("End Date")                                                 AS end_date
FROM raw_hrrp
ORDER BY ccn, condition;
