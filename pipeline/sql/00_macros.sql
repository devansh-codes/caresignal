-- Shared scalar macros. `na()` turns CMS "no value" text into NULL; {NA_LIST} is filled in
-- by transform.py from pipeline.common.NA_STRINGS.
CREATE OR REPLACE MACRO na(x) AS
    CASE WHEN x IS NULL OR trim(x) IN ({NA_LIST}) THEN NULL ELSE trim(x) END;
CREATE OR REPLACE MACRO num(x) AS TRY_CAST(replace(replace(na(x), ',', ''), '%', '') AS DOUBLE);
CREATE OR REPLACE MACRO int_(x) AS TRY_CAST(TRY_CAST(replace(na(x), ',', '') AS DOUBLE) AS BIGINT);
CREATE OR REPLACE MACRO iso(x) AS strftime(TRY_STRPTIME(na(x), '%m/%d/%Y'), '%Y-%m-%d');
CREATE OR REPLACE MACRO ccn(x) AS CASE WHEN na(x) IS NULL THEN NULL ELSE lpad(trim(x), 6, '0') END;
