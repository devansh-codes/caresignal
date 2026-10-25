-- HAI file is one row per (facility, HAI_n_METRIC). Pivot metrics to columns: one row per facility x infection.
CREATE OR REPLACE TABLE hai AS
WITH src AS (
    SELECT
        ccn("Facility ID")                                AS ccn,
        regexp_extract("Measure ID", '^(HAI_\d+)_', 1)    AS hai_id,
        regexp_extract("Measure ID", '^HAI_\d+_(.+)$', 1) AS metric,
        "Score"                                           AS score,
        na("Footnote")                                    AS footnote,
        na("Compared to National")                        AS compared_to_national,
        iso("Start Date")                                 AS start_date,
        iso("End Date")                                   AS end_date
    FROM raw_hai
)
SELECT
    s.ccn,
    k.key,
    s.hai_id,
    max(num(score)) FILTER (WHERE metric = 'SIR')             AS sir,
    max(footnote) FILTER (WHERE metric = 'SIR')               AS sir_fn,
    max(num(score)) FILTER (WHERE metric = 'NUMERATOR')       AS observed,
    max(num(score)) FILTER (WHERE metric = 'ELIGCASES')       AS predicted,
    max(num(score)) FILTER (WHERE metric = 'DOPC')            AS device_days,
    max(num(score)) FILTER (WHERE metric = 'CILOWER')         AS ci_lower,
    max(num(score)) FILTER (WHERE metric = 'CIUPPER')         AS ci_upper,
    max(compared_to_national) FILTER (WHERE metric = 'SIR')   AS compared_to_national,
    max(start_date)                                           AS start_date,
    max(end_date)                                             AS end_date
FROM src s
JOIN hai_keys k ON k.hai_id = s.hai_id
GROUP BY s.ccn, k.key, s.hai_id
ORDER BY s.ccn, s.hai_id;
