-- IT Department project management tables (idempotent, safe to re-run; never drops data).
-- Run against the HRMS database (DB_NAME, e.g. wise_hris):
--   mysql -u root -p wise_hris < db/001_it_department_tables.sql
-- or: npm run db:migrate

CREATE TABLE IF NOT EXISTS it_department_projects (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  owner_name VARCHAR(160) NOT NULL,
  project_name VARCHAR(200) NOT NULL,
  project_link VARCHAR(500) NOT NULL DEFAULT '',
  trello_link VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(40) NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  deadline DATE NOT NULL,
  notes TEXT NOT NULL,
  assignees TEXT NOT NULL,
  archived TINYINT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS it_department_logs (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  actor VARCHAR(160) NOT NULL,
  action VARCHAR(40) NOT NULL,
  project_name VARCHAR(200) NOT NULL DEFAULT '',
  project_id VARCHAR(64) NULL DEFAULT NULL,
  employee_name VARCHAR(160) NOT NULL DEFAULT '',
  detail TEXT NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_logs_project_id (project_id)
);
