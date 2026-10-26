import type mysql from "mysql2/promise";
import { withDb } from "@/lib/db.ts";
import {
  effectiveAccess,
  hrmsDefaultAccess,
  isAppRole,
  protectionOf,
  type AccessRow,
  type AccessSource,
  type AppRole,
  type Protection,
} from "@/lib/access-rules.ts";

export const USER_ACCESS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS it_department_user_access (
  employee_number VARCHAR(20) NOT NULL PRIMARY KEY,
  role VARCHAR(20) NOT NULL DEFAULT 'none',
  enabled TINYINT NOT NULL DEFAULT 1,
  updated_by VARCHAR(160) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

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

type StoredRow = { employee_number: string; role: string; enabled: number; updated_by: string; updated_at: Date | string };

function toAccessRow(row: StoredRow | undefined): AccessRow {
  if (!row) return null;
  return { role: isAppRole(row.role) ? row.role : "none", enabled: Number(row.enabled) === 1 };
}

async function ensureTable(connection: mysql.Connection) {
  await connection.query(USER_ACCESS_TABLE_SQL);
}

/** Admin decision for one employee; undefined when the DB is not reachable (caller keeps the cookie access). */
export async function readAccessRow(employeeNumber: string): Promise<AccessRow | undefined> {
  const result = await withDb(async (connection) => {
    await ensureTable(connection);
    const [rows] = await connection.query(
      "SELECT employee_number, role, enabled, updated_by, updated_at FROM it_department_user_access WHERE employee_number = ?",
      [employeeNumber],
    );
    return { row: toAccessRow((rows as StoredRow[])[0]) };
  }).catch(() => null);
  return result ? result.row : undefined;
}

/** Every HRIS employee (read-only on HRMS tables) with their access to this app. */
export async function listManagedUsers(): Promise<ManagedUser[] | null> {
  return withDb(async (connection) => {
    await ensureTable(connection);
    const [people] = await connection.query(
      `SELECT e.employee_number,
              TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS name,
              COALESCE(NULLIF(e.company_email, ''), NULLIF(u.email, ''), e.personal_email, '') AS email,
              COALESCE(d.code, '') AS dept_code,
              COALESCE(d.name, '') AS dept_name,
              COALESCE(p.title, '') AS position,
              COALESCE(r.name, '') AS role_name,
              COALESCE(r.label, '') AS role_label,
              (e.is_active = 1 AND e.date_separated IS NULL AND (u.id IS NULL OR u.is_active = 1)) AS active
       FROM employees e
       LEFT JOIN users u ON u.employee_id = e.id AND u.deleted_at IS NULL
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN positions p ON p.id = e.position_id
       WHERE e.deleted_at IS NULL AND COALESCE(e.permanently_removed, 0) = 0
         AND e.employee_number IS NOT NULL AND e.employee_number <> ''
       ORDER BY e.last_name, e.first_name`,
    );
    const [stored] = await connection.query(
      "SELECT employee_number, role, enabled, updated_by, updated_at FROM it_department_user_access",
    );
    const byId = new Map((stored as StoredRow[]).map((row) => [row.employee_number.trim().toLowerCase(), row]));
    const seen = new Set<string>();
    return (people as Record<string, string | number | null>[]).flatMap((row) => {
      const employeeNumber = String(row.employee_number ?? "").trim();
      const key = employeeNumber.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      const hrisDefault = hrmsDefaultAccess({
        accountType: String(row.role_name ?? ""),
        position: String(row.position ?? ""),
        departmentCode: String(row.dept_code ?? ""),
        departmentName: String(row.dept_name ?? ""),
      });
      const storedRow = byId.get(key);
      const decided = effectiveAccess(employeeNumber, hrisDefault, toAccessRow(storedRow));
      const updatedAt = storedRow?.updated_at;
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
          protection: protectionOf(employeeNumber),
          enabled: decided.enabled,
          updatedBy: storedRow?.updated_by ?? "",
          updatedAt: updatedAt ? new Date(updatedAt).toISOString() : "",
        },
      ];
    });
  });
}

export async function saveAccessRow(employeeNumber: string, role: AppRole, enabled: boolean, actor: string) {
  const saved = await withDb(async (connection) => {
    await ensureTable(connection);
    await connection.query(
      `INSERT INTO it_department_user_access (employee_number, role, enabled, updated_by, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE role = VALUES(role), enabled = VALUES(enabled),
         updated_by = VALUES(updated_by), updated_at = NOW()`,
      [employeeNumber.slice(0, 20), role, enabled ? 1 : 0, actor.slice(0, 160)],
    );
    return true;
  });
  if (!saved) throw new Error("Database is not reachable");
}