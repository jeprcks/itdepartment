# HRIS SSO

HRMS (Wise-HRMS) is the only identity provider. There is no local login and no logout button.

## Flow

1. A logged-in HRMS user clicks **Project Management** in the HRMS nav (`POST /sso/project-management/launch`).
2. HRMS issues a one-time token (SHA-256 hash stored in `sso_handshake_tokens`, TTL 15-120 s) and auto-posts it to `POST /api/sso/hris` here.
3. This app calls `HRIS_SSO_CONSUME_URL` (`/api/sso/project-management/consume`) with `{ token, nonce, audience: "project_management" }`, HMAC-SHA256 signed over `timestamp + "." + body` (`X-SSO-Timestamp`, `X-SSO-Signature`) with `HRIS_SSO_SECRET` (= HRMS `PROJECT_MANAGEMENT_SSO_SECRET`). The HRMS reply is verified the same way, plus nonce and audience.
4. HRMS returns `hrms_user_id, employee_number, email, display_name, hrms_role, position_title, department_code, department_name, is_active`.
5. `lib/sso/access.ts` maps the user to an access level, or denies (redirect to `/access-denied`, no cookie).
6. Allowed users get an HttpOnly `it_pm_session` cookie signed with `IT_PM_SESSION_SECRET` (different from the HMAC secret), lifetime `IT_PM_SESSION_MAX_AGE_SECONDS` (default 7200 = 2 h). No instant revocation: changes in HRMS apply at next launch.

`proxy.ts` checks the cookie (signature + expiry) on every page and API route except `/api/sso/hris` and `/access-denied`. Pages also call `requireSession()`. Missing/expired session: pages redirect to `HRIS_DASHBOARD_URL`, APIs return 401.

## Access levels

HRMS decides who can open the app: the "IT Department" nav link and the launch/consume endpoints only allow `super_admin`, the President (role `president` or position `President`) and employees whose department (employee department, else position department) is IT (code or name `IT`, `IT Department`, `Information Technology`). super_admin accounts without an employee number are sent as `ADMIN-<user id>`.

itdepartment accepts every user HRMS authenticates:

| Level | Who | Rights |
| --- | --- | --- |
| `super_admin` | HRMS role `super_admin` | everything |
| `president` | HRMS role `president`, or position in `IT_PM_PRESIDENT_POSITIONS` (default `President`) | CRUD on all projects |
| `it_staff` | everyone else HRMS lets through | CRUD only on projects they own or are assigned to |

`IT_PM_IT_DEPARTMENT_CODES` / `IT_PM_IT_DEPARTMENT_NAMES` are no longer used. `/access-denied` is only shown as a sign-in fallback when `HRIS_DASHBOARD_URL` is not set.
## Project storage and server-side ownership

Projects and activity logs live in MySQL (`DB_*` in `.env`, the HRMS database, e.g. `wise_hris`) in `it_department_projects` and `it_department_logs`, the same tables the HRMS `/api/sso/project-management/projects` endpoint uses. itdepartment connects directly with `mysql2` (`lib/db.ts`); if the DB is not configured or unreachable it falls back to the signed HRMS endpoint.

- Schema: `db/001_it_department_tables.sql` (idempotent). Run `npm run db:migrate`; the app also creates missing tables/columns on first use. Nothing is ever dropped.
- `app/api/projects` enforces ownership on the server (`lib/project-access.ts`) using the session from `lib/sso`: `super_admin`/`president` full CRUD; `it_staff` can create only as owner and edit/archive/reopen only projects they own or are assigned to (checked against the stored row). Denied requests return 403.
- No localStorage is used.

## Environment variables (set on the server, never commit values)

- `HRIS_SSO_ENABLED` (`true` to allow logins)
- `HRIS_SSO_SECRET` (shared with HRMS, >= 32 chars)
- `HRIS_SSO_CONSUME_URL`
- `HRIS_SSO_ALLOWED_PATHS`
- `HRIS_DASHBOARD_URL` (sidebar "Back to HRMS Dashboard" + sign-in redirect)
- `IT_PM_SESSION_SECRET` (>= 32 chars, must differ from `HRIS_SSO_SECRET`)
- `IT_PM_SESSION_MAX_AGE_SECONDS` (default 7200, clamped 300-28800)
- `IT_PM_PRESIDENT_POSITIONS`, `IT_PM_IT_DEPARTMENT_CODES`, `IT_PM_IT_DEPARTMENT_NAMES` (comma lists)

## User Management (who can open IT Department)

Page at `/users` (sidebar "User Management"), open ONLY to the Super Admin and Admin. Lists every HRIS employee (read-only on
`employees`, `users`, `roles`, `departments`, `positions`). Decisions are stored in
`it_department_user_access` (db/003_user_access.sql, created by `npm run db:migrate`).

Access at login and on every request (re-checked every ~5 s, so changes apply without re-login):
1. `IT_PM_BOOTSTRAP_SUPER_ADMINS` (e.g. `WS168`, Arley, IT head) -> always Super Admin; nobody can edit, demote or disable them.
   `IT_PM_BOOTSTRAP_ADMINS` (e.g. `WS-001`, Ben) -> Admin: sees and edits everything and everyone except the Super Admin; only the Super Admin can change an Admin.
   These env lists are the only way to get Super Admin / Admin; nobody can assign Super Admin in the UI, and stored or HRMS super_admin/admin elsewhere is capped at President.
2. A row in `it_department_user_access` -> the admin's role; disabled or "No access" = denied (`/access-denied?reason=noaccess`).
3. No row -> the existing HRMS rule (HRMS super_admin / president -> President; other HRMS-eligible IT staff -> IT Staff).
4. DB unreachable -> the HRMS rule / signed cookie is kept, so an outage never locks everyone out.

Nobody can change their own access. Every change is written to Activity logs
(actions "Role changed", "Access enabled", "Access disabled").
Note: HRMS still decides who sees the launch button (IT department, President, super_admin). Granting
access here to someone outside that group only works once HRMS lets them launch.

### View only role (`viewer`)
Assignable by the Super Admin and Admin in Edit role / Add user (label "View only"). A viewer can sign in and look at the
dashboard, project details, activity logs and archive. Every change is refused server-side with 403
(`POST /api/projects` create/edit/archive/reopen, `POST /api/logs`, sending notifications), and CSV exports
(`/api/export/projects`, `/api/export/logs`) are also 403 for viewers (on-screen reading only). Buttons are hidden and a
"View only" badge is shown. Viewers cannot open User Management. HRMS never gives `viewer` by default; it only comes from
a decision stored on the User Management page. HRMS still only shows the launch button to IT staff, the President and
super_admin, so a View only account outside IT cannot launch the app until HRMS allows it.

### Roles shown across the app
The sidebar badge and the dashboard header show the signed-in role (Super Admin / Admin / President / IT Staff / View only).
Activity logs store the actor's role at the time (`it_department_logs.actor_role`, db/004, added by `npm run db:migrate`;
older and HRMS-written rows have none). The logs page shows it under "Changed by", has a Role filter, and the CSV export has a
"Role" column. Access changes read like "BEN RYAN YBANEZ (Admin) changed IT Department access for DINNES OBERES: Role: No access ? View only."
