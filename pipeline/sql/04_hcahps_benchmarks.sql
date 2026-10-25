-- National (99ue-w85f) and state (84jm-wiui) HCAHPS top-box benchmarks.
CREATE OR REPLACE TABLE hcahps_benchmarks AS
SELECT 'NATION' AS level, "HCAHPS Measure ID" AS measure_id, num("HCAHPS Answer Percent") AS answer_pct,
       iso("Start Date") AS start_date, iso("End Date") AS end_date
FROM raw_hcahps_national
UNION ALL
SELECT upper(trim("State")), "HCAHPS Measure ID", num("HCAHPS Answer Percent"),
       iso("Start Date"), iso("End Date")
FROM raw_hcahps_state
ORDER BY level, measure_id;
