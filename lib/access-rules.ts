import type { AccessLevel } from "./sso/access.ts";

type Env = Record<string, string | undefined>;

/** Role in this app; "none" = no access. */
export type AppRole = AccessLevel | "none";
export const APP_ROLES: AppRole[] = ["super_admin", "admin", "president", "it_staff", "viewer", "none"];
export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  president: "President",
  it_staff: "IT Staff",
  viewer: "View only",
  none: "No access",
};

export type AccessRow = { role: AppRole; enabled: boolean } | null;
export type AccessSource = "bootstrap" | "override" | "hris";
export type Protection = "super_admin" | "admin" | null;
export type EffectiveAccess = { access: AppRole; source: AccessSource; enabled: boolean };

function list(raw: string | undefined, fallback: string) {
  return (raw ?? fallback)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as string[]).includes(value);
}

/** Only Super Admin and Admin may open User Management. */
export function canManageUsers(access: string) {
  return access === "super_admin" || access === "admin";
}

/**
 * IT_PM_BOOTSTRAP_SUPER_ADMINS -> protected Super Admin (nobody can edit, demote or disable).
 * IT_PM_BOOTSTRAP_ADMINS       -> protected Admin (only the Super Admin can change them).
 * These env lists are the ONLY way to get super_admin / admin.
 */
export function protectionOf(employeeNumber: string, env: Env = process.env): Protection {
  const id = employeeNumber.trim().toLowerCase();
  if (!id) return null;
  if (list(env.IT_PM_BOOTSTRAP_SUPER_ADMINS, "").includes(id)) return "super_admin";
  if (list(env.IT_PM_BOOTSTRAP_ADMINS, "").includes(id)) return "admin";
  return null;
}

/**
 * Default when no decision is stored. Mirrors HRMS isEligible(): HRMS super_admin / president
 * (role or position) -> President, IT Department staff -> IT Staff, everyone else -> No access.
 */
export function hrmsDefaultAccess(
  input: { accountType: string; position: string; departmentCode: string; departmentName: string },
  env: Env = process.env,
): AppRole {
  const role = input.accountType.trim().toLowerCase();
  if (role === "super_admin" || role === "president") return "president";
  const position = input.position.trim().toLowerCase();
  if (position !== "" && list(env.IT_PM_PRESIDENT_POSITIONS, "President").includes(position)) return "president";
  const codes = list(env.IT_PM_IT_DEPARTMENT_CODES, "IT");
  const names = list(env.IT_PM_IT_DEPARTMENT_NAMES, "IT,IT Department,Information Technology");
  const code = input.departmentCode.trim().toLowerCase();
  const name = input.departmentName.trim().toLowerCase();
  if ((code && codes.includes(code)) || (name && names.includes(name))) return "it_staff";
  return "none";
}

/** super_admin / admin outside the env lists are capped at President (full projects, no User Management). */
function cap(role: AppRole, protection: Protection): AppRole {
  if (role === "super_admin") return "president";
  if (role === "admin" && protection !== "admin") return "president";
  return role;
}

/** Order: protected Super Admin > stored decision > protected Admin default > HRMS default. */
export function effectiveAccess(
  employeeNumber: string,
  hrmsDefault: AppRole,
  row: AccessRow,
  env: Env = process.env,
): EffectiveAccess {
  const protection = protectionOf(employeeNumber, env);
  if (protection === "super_admin") return { access: "super_admin", source: "bootstrap", enabled: true };
  if (row) return { access: row.enabled ? cap(row.role, protection) : "none", source: "override", enabled: row.enabled };
  if (protection === "admin") return { access: "admin", source: "bootstrap", enabled: true };
  return { access: cap(hrmsDefault, null), source: "hris", enabled: true };
}

/** Roles the actor may pick for the target in Edit role / Add user. Super Admin is never assignable. */
export function assignableRoles(actorAccess: string, targetEmployeeNumber: string, env: Env = process.env): AppRole[] {
  const base: AppRole[] = ["president", "it_staff", "viewer", "none"];
  return actorAccess === "super_admin" && protectionOf(targetEmployeeNumber, env) === "admin" ? ["admin", ...base] : base;
}

export type ChangeDecision = { ok: true } | { ok: false; status: 400 | 403; error: string };

/** Server-side rules for User Management. */
export function authorizeAccessChange(
  actor: { sub: string; access: string },
  target: { employeeNumber: string; role: AppRole; enabled: boolean },
  env: Env = process.env,
): ChangeDecision {
  const deny = (error: string): ChangeDecision => ({ ok: false, status: 403, error });
  if (!canManageUsers(actor.access)) return deny("Only the Super Admin and Admin can manage users.");
  if (!target.employeeNumber.trim()) return { ok: false, status: 400, error: "Employee is required." };
  if (!isAppRole(target.role)) return { ok: false, status: 400, error: "Unknown role." };
  const protection = protectionOf(target.employeeNumber, env);
  if (protection === "super_admin") return deny("The Super Admin cannot be edited, demoted or disabled.");
  if (actor.sub.trim().toLowerCase() === target.employeeNumber.trim().toLowerCase()) {
    return deny("You cannot change your own access.");
  }
  if (protection === "admin" && actor.access !== "super_admin") return deny("Only the Super Admin can change an Admin.");
  if (!assignableRoles(actor.access, target.employeeNumber, env).includes(target.role)) {
    return deny(`${ROLE_LABELS[target.role]} cannot be assigned here.`);
  }
  return { ok: true };
}