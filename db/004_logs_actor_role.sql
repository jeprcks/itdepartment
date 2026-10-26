-- 004: remember the role the actor had when they made the change (super_admin, admin, president, it_staff, viewer).
-- Nullable: old rows and HRMS-written rows stay NULL and show without a role. Never drops data.
-- `npm run db:migrate` adds it only when missing (checked via information_schema).
ALTER TABLE it_department_logs ADD COLUMN actor_role VARCHAR(20) NULL DEFAULT NULL AFTER actor;