-- One row per facility in Hospital General Information (xubh-q36u), enriched with
-- cost-report size/teaching/location and Medicare inpatient payments.
CREATE OR REPLACE TABLE hospitals AS
WITH cost AS (
    SELECT
        ccn("Provider CCN")                                    AS ccn,
        num("Number of Beds")                                  AS beds,
        -- A filed report with a blank interns/residents line means zero residents.
        coalesce(num("Number of Interns and Residents (FTE)"), 0) AS resident_fte,
        -- Geographic location from the CBSA (CMS rural areas are 999xx). The "Rural Versus Urban"
        -- field reflects §412.103 rural reclassification (e.g. MGH, UCSF report 'R'), so it is
        -- only a fallback when the CBSA is missing.
        CASE
            WHEN na("Medicare CBSA Number") LIKE '999%' THEN 'rural'
            WHEN na("Medicare CBSA Number") IS NOT NULL THEN 'urban'
            WHEN na("Rural Versus Urban") = 'U' THEN 'urban'
            WHEN na("Rural Versus Urban") = 'R' THEN 'rural'
        END                                                    AS urban_rural,
        na("Medicare CBSA Number")                             AS cbsa,
        TRY_STRPTIME(na("Fiscal Year End Date"), '%m/%d/%Y')   AS fy_end,
        row_number() OVER (
            PARTITION BY ccn("Provider CCN")
            ORDER BY TRY_STRPTIME(na("Fiscal Year End Date"), '%m/%d/%Y') DESC NULLS LAST,
                     TRY_CAST(rpt_rec_num AS BIGINT) DESC
        ) AS rn
    FROM raw_cost_report
),
mcr AS (
    SELECT
        ccn(Rndrng_Prvdr_CCN)  AS ccn,
        num(Tot_Mdcr_Pymt_Amt) AS medicare_payments,
        num(Tot_Pymt_Amt)      AS medicare_total_payments,
        int_(Tot_Dschrgs)      AS medicare_discharges
    FROM raw_medicare_inpatient
)
SELECT
    ccn(g."Facility ID")                       AS ccn,
    na(g."Facility Name")                      AS name,
    na(g."Address")                            AS address,
    na(g."City/Town")                          AS city,
    na(g."State")                              AS state,
    na(g."ZIP Code")                           AS zip,
    na(g."County/Parish")                      AS county,
    na(g."Telephone Number")                   AS phone,
    na(g."Hospital Type")                      AS hospital_type,
    na(g."Hospital Ownership")                 AS ownership,
    CASE na(g."Emergency Services") WHEN 'Yes' THEN TRUE WHEN 'No' THEN FALSE END AS emergency_services,
    TRY_CAST(na(g."Hospital overall rating") AS INTEGER) AS overall_rating,
    na(g."Hospital overall rating footnote")   AS overall_rating_fn,
    r.region                                   AS census_region,
    c.beds,
    c.resident_fte,
    c.urban_rural,
    c.cbsa,
    CAST(year(c.fy_end) AS INTEGER)            AS cost_report_year,
    m.medicare_payments,
    m.medicare_total_payments,
    m.medicare_discharges
FROM raw_general g
LEFT JOIN census_regions r ON r.state = upper(na(g."State"))
LEFT JOIN cost c ON c.ccn = ccn(g."Facility ID") AND c.rn = 1
LEFT JOIN mcr m ON m.ccn = ccn(g."Facility ID")
ORDER BY ccn;
