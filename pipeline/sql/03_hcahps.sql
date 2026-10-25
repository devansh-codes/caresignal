-- HCAHPS stays long (one row per facility x HCAHPS measure id). Star ratings live on *_STAR_RATING rows.
CREATE OR REPLACE TABLE hcahps AS
SELECT
    ccn("Facility ID")                              AS ccn,
    "HCAHPS Measure ID"                             AS measure_id,
    na("HCAHPS Question")                           AS question,
    na("HCAHPS Answer Description")                 AS answer_desc,
    num("HCAHPS Answer Percent")                    AS answer_pct,
    na("HCAHPS Answer Percent Footnote")            AS answer_pct_fn,
    TRY_CAST(na("Patient Survey Star Rating") AS INTEGER) AS star_rating,
    num("HCAHPS Linear Mean Value")                 AS linear_mean,
    int_("Number of Completed Surveys")             AS completed_surveys,
    num("Survey Response Rate Percent")             AS response_rate,
    iso("Start Date")                               AS start_date,
    iso("End Date")                                 AS end_date
FROM raw_hcahps
ORDER BY ccn, measure_id;
