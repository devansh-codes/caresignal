-- PSI measures: six-digit rate (muwa-iene, used for the HAC rebuild) joined to the
-- Complications & Deaths file (ynj2-r877) for comparison category, CI and denominator.
CREATE OR REPLACE TABLE psi AS
WITH six AS (
    SELECT ccn("Facility ID") AS ccn, "Measure ID" AS measure_id, na("Measure Name") AS measure_name,
           num("Rate") AS rate, na("Footnote") AS rate_fn,
           iso("Start Date") AS start_date, iso("End Date") AS end_date
    FROM raw_psi_six
),
cd AS (
    SELECT ccn("Facility ID") AS ccn, "Measure ID" AS measure_id, na("Measure Name") AS measure_name,
           num("Score") AS score, na("Footnote") AS score_fn, na("Compared to National") AS compared_to_national,
           num("Lower Estimate") AS lower, num("Higher Estimate") AS higher, num("Denominator") AS denominator,
           iso("Start Date") AS start_date, iso("End Date") AS end_date
    FROM raw_complications
    WHERE "Measure ID" LIKE 'PSI\_%' ESCAPE '\'
)
SELECT
    coalesce(six.ccn, cd.ccn)                       AS ccn,
    coalesce(six.measure_id, cd.measure_id)         AS measure_id,
    coalesce(six.measure_name, cd.measure_name)     AS measure_name,
    six.rate,
    six.rate_fn,
    cd.score,
    cd.score_fn,
    cd.compared_to_national,
    cd.lower,
    cd.higher,
    cd.denominator,
    coalesce(six.start_date, cd.start_date)         AS start_date,
    coalesce(six.end_date, cd.end_date)             AS end_date,
    CASE WHEN six.ccn IS NOT NULL AND cd.ccn IS NOT NULL THEN 'muwa-iene+ynj2-r877'
         WHEN six.ccn IS NOT NULL THEN 'muwa-iene' ELSE 'ynj2-r877' END AS source
FROM six
FULL OUTER JOIN cd ON six.ccn = cd.ccn AND six.measure_id = cd.measure_id
ORDER BY ccn, measure_id;
