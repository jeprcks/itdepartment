-- 002: link activity logs to projects by ID so history survives renames. Never drops data.
-- MySQL has no "ADD COLUMN IF NOT EXISTS"; `npm run db:migrate` applies these only when missing
-- (checked via information_schema). Run by hand only on a DB that does not have them yet.

ALTER TABLE it_department_logs ADD COLUMN project_id VARCHAR(64) NULL DEFAULT NULL AFTER project_name;
ALTER TABLE it_department_logs ADD INDEX idx_logs_project_id (project_id);

-- Backfill: set project_id where the log's project name matches exactly one project (case/space-insensitive).
UPDATE it_department_logs l
JOIN (
  SELECT k, MIN(id) AS id
  FROM (SELECT LOWER(TRIM(project_name)) AS k, id FROM it_department_projects) names
  GROUP BY k
  HAVING COUNT(*) = 1
) p ON p.k = LOWER(TRIM(l.project_name))
SET l.project_id = p.id
WHERE l.project_id IS NULL AND TRIM(l.project_name) <> '';
