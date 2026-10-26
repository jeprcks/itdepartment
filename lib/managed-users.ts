import {
  effectiveAccess,
  hrmsDefaultAccess,
  isAppRole,
  protectionOf,
  type AccessRow,
  type AccessSource,
  type AppRole,
  type Protection,
} from "./access-rules.ts";

export type ManagedUser = {
  employeeNumber: string;
  name: string;
  email: string;
  department: string;
  position: string;
  hrisRole: string;
  hrisActive: boolean;
  hrisDefault: AppRole;
  /** Role the admin stored (kept while disabled), else the HRIS default. */
  assignedRole: AppRole;
  access: AppRole;
  source: AccessSource;
  protection: Protection;
  enabled: boolean;
  updatedBy: string;
  updatedAt: string;
};

export type StoredRow = {
  employee_number: string;
  role: string;
  enabled: number | boolean;
  updated_by: string;
  updated_at: Date | string;
};

export type PersonRow = {
  employee_number: string | null;
  name: string | null;
  email: string | null;
  dept_code: string | null;
  dept_name: string | null;
  position: string | null;
  role_name: string | null;
  role_label: string | null;
  active: number | string | null;
};

export function toAccessRow(row: StoredRow | undefined | null): AccessRow {
  if (!row) return null;
  return { role: isAppRole(row.role) ? row.role : "none", enabled: Number(row.enabled) === 1 };
}

/** Same result whether rows came from MySQL directly or from the HRMS signed endpoint. */
export function buildManagedUsers(people: PersonRow[], stored: StoredRow[], env: Record<string, string | undefined> = process.env): ManagedUser[] {
  const byId = new Map(stored.map((row) => [String(row.employee_number).trim().toLowerCase(), row]));
  const seen = new Set<string>();
  return people.flatMap((row) => {
    const employeeNumber = String(row.employee_number ?? "").trim();
    const key = employeeNumber.toLowerCase();
    if (!employeeNumber || seen.has(key)) return [];
    seen.add(key);
    const hrisDefault = hrmsDefaultAccess(
      {
        accountType: String(row.role_name ?? ""),
        position: String(row.position ?? ""),
        departmentCode: String(row.dept_code ?? ""),
        departmentName: String(row.dept_name ?? ""),
      },
      env,
    );
    const storedRow = byId.get(key);
    const decided = effectiveAccess(employeeNumber, hrisDefault, toAccessRow(storedRow), env);
    const updatedAt = storedRow?.updated_at ? new Date(storedRow.updated_at) : null;
    return [
      {
        employeeNumber,
        name: String(row.name ?? "") || employeeNumber,
        email: String(row.email ?? ""),
        department: String(row.dept_name ?? ""),
        position: String(row.position ?? ""),
        hrisRole: String(row.role_label ?? ""),
        hrisActive: Number(row.active) === 1,
        hrisDefault,
        assignedRole: storedRow && isAppRole(storedRow.role) ? storedRow.role : hrisDefault,
        access: decided.access,
        source: decided.source,
        protection: protectionOf(employeeNumber, env),
        enabled: decided.enabled,
        updatedBy: storedRow?.updated_by ?? "",
        updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toISOString() : "",
      },
    ];
  });
}
