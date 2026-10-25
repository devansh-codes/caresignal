-- Timely and Effective Care (process measures incl. SEP_1). Some scores are categorical text (e.g. EDV 'high').
CREATE OR REPLACE TABLE timely_care AS
SELECT
    ccn("Facility ID")      AS ccn,
    na("Condition")         AS condition,
    "Measure ID"            AS measure_id,
    na("Measure Name")      AS measure_name,
    num("Score")            AS score,
    na("Score")             AS score_text,
    int_("Sample")          AS sample,
    na("Footnote")          AS footnote,
    iso("Start Date")       AS start_date,
    iso("End Date")         AS end_date
FROM raw_timely
ORDER BY ccn, measure_id;
