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
Projects are still client-side (localStorage/seed data). Ownership checks (`canEditProject`) currently run in the UI only; server-side enforcement needs a server project store (pending decision).

## Environment variables (set on the server, never commit values)

- `HRIS_SSO_ENABLED` (`true` to allow logins)
- `HRIS_SSO_SECRET` (shared with HRMS, >= 32 chars)
- `HRIS_SSO_CONSUME_URL`
- `HRIS_SSO_ALLOWED_PATHS`
- `HRIS_DASHBOARD_URL` (sidebar "Back to HRMS Dashboard" + sign-in redirect)
- `IT_PM_SESSION_SECRET` (>= 32 chars, must differ from `HRIS_SSO_SECRET`)
- `IT_PM_SESSION_MAX_AGE_SECONDS` (default 7200, clamped 300-28800)
- `IT_PM_PRESIDENT_POSITIONS`, `IT_PM_IT_DEPARTMENT_CODES`, `IT_PM_IT_DEPARTMENT_NAMES` (comma lists)
