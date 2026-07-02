-- One submission per work on a site (when work_id is set). Merge any existing
-- duplicates before adding the constraint so deploy does not fail on legacy data.
WITH ranked AS (
  SELECT
    id,
    work_id,
    site_id,
    ROW_NUMBER() OVER (
      PARTITION BY work_id, site_id
      ORDER BY date_created ASC, id ASC
    ) AS rn
  FROM "Submission"
  WHERE work_id IS NOT NULL
),
dupes AS (
  SELECT id AS duplicate_id, work_id, site_id
  FROM ranked
  WHERE rn > 1
),
keepers AS (
  SELECT id AS keep_id, work_id, site_id
  FROM ranked
  WHERE rn = 1
)
UPDATE "SubmissionVersion" sv
SET submission_id = k.keep_id
FROM dupes d
JOIN keepers k ON k.work_id = d.work_id AND k.site_id = d.site_id
WHERE sv.submission_id = d.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    work_id,
    site_id,
    ROW_NUMBER() OVER (
      PARTITION BY work_id, site_id
      ORDER BY date_created ASC, id ASC
    ) AS rn
  FROM "Submission"
  WHERE work_id IS NOT NULL
),
dupes AS (
  SELECT id AS duplicate_id, work_id, site_id
  FROM ranked
  WHERE rn > 1
),
keepers AS (
  SELECT id AS keep_id, work_id, site_id
  FROM ranked
  WHERE rn = 1
)
UPDATE "Activity" a
SET submission_id = k.keep_id
FROM dupes d
JOIN keepers k ON k.work_id = d.work_id AND k.site_id = d.site_id
WHERE a.submission_id = d.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    work_id,
    site_id,
    ROW_NUMBER() OVER (
      PARTITION BY work_id, site_id
      ORDER BY date_created ASC, id ASC
    ) AS rn
  FROM "Submission"
  WHERE work_id IS NOT NULL
),
dupes AS (
  SELECT id AS duplicate_id, work_id, site_id
  FROM ranked
  WHERE rn > 1
),
keepers AS (
  SELECT id AS keep_id, work_id, site_id
  FROM ranked
  WHERE rn = 1
)
UPDATE "SubmissionSearch" ss
SET submission_id = k.keep_id
FROM dupes d
JOIN keepers k ON k.work_id = d.work_id AND k.site_id = d.site_id
WHERE ss.submission_id = d.duplicate_id;

DELETE FROM "Slug"
WHERE submission_id IN (
  SELECT duplicate_id
  FROM (
    SELECT
      id AS duplicate_id,
      ROW_NUMBER() OVER (
        PARTITION BY work_id, site_id
        ORDER BY date_created ASC, id ASC
      ) AS rn
    FROM "Submission"
    WHERE work_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

DELETE FROM "Submission"
WHERE id IN (
  SELECT duplicate_id
  FROM (
    SELECT
      id AS duplicate_id,
      ROW_NUMBER() OVER (
        PARTITION BY work_id, site_id
        ORDER BY date_created ASC, id ASC
      ) AS rn
    FROM "Submission"
    WHERE work_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX "Submission_work_id_site_id_key" ON "Submission"("work_id", "site_id");
