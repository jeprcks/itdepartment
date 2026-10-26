-- 003: per-user access to the IT Department app, decided by the admin on the User Management page.
-- Keyed by HRMS employees.employee_number (the SSO subject). Read-only on HRMS tables; never drops data.
-- Safe to re-run (CREATE TABLE IF NOT EXISTS). `npm run db:migrate` applies it.
CREATE TABLE IF NOT EXISTS it_department_user_access (
  employee_number VARCHAR(20) NOT NULL PRIMARY KEY,
  role VARCHAR(20) NOT NULL DEFAULT 'none',
  enabled TINYINT NOT NULL DEFAULT 1,
  updated_by VARCHAR(160) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);