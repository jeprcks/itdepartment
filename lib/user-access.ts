import type mysql from "mysql2/promise";
import { withDb } from "@/lib/db.ts";
import { callHris } from "@/lib/hris-client.ts";
import type { AccessRow, AppRole } from "@/lib/access-rules.ts";
import { buildManagedUsers, toAccessRow, type ManagedUser, type PersonRow, type StoredRow } from "@/lib/managed-users.ts";

export type { ManagedUser } from "@/lib/managed-users.ts";

export const USER_ACCESS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS it_department_user_access (
  employee_number VARCHAR(20) NOT NULL PRIMARY KEY,
  role VARCHAR(20) NOT NULL DEFAULT 'none',
  enabled TINYINT NOT NULL DEFAULT 1,
  updated_by VARCHAR(160) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function ensureTable(connection: mysql.Connection) {
  await connection.query(USER_ACCESS_TABLE_SQL);
}

/**
 * Admin decision for one employee. Direct MySQL first, then the HRMS signed endpoint.
 * undefined = neither reachable (caller keeps the signed cookie / HRMS rule, so nobody is locked out).
 */
export async function readAccessRow(employeeNumber: string): Promise<AccessRow | undefined> {
  const direct = await withDb(async (connection) => {
    await ensureTable(connection);
    const [rows] = await connection.query(
      "SELECT employee_number, role, enabled, updated_by, updated_at FROM it_department_user_access WHERE employee_number = ?",
      [employeeNumber],
    );
    return { row: toAccessRow((rows as StoredRow[])[0]) };
  }).catch(() => null);
  if (direct) return direct.row;
  const viaHris = await callHris("user_access_get", { employee_number: employeeNumber });
  if (!viaHris) return undefined;
  return toAccessRow((viaHris.access as StoredRow | null) ?? null);
}

/** Every HRIS employee with their access to this app. Direct MySQL first, then HRMS. Null if neither works. */
export async function listManagedUsers(): Promise<ManagedUser[] | null> {
  const direct = await withDb(async (connection) => {
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
    return buildManagedUsers(people as PersonRow[], stored as StoredRow[]);
  }).catch(() => null);
  if (direct) return direct;
  const viaHris = await callHris("users_list");
  if (!viaHris || !Array.isArray(viaHris.people) || !Array.isArray(viaHris.access)) return null;
  return buildManagedUsers(viaHris.people as PersonRow[], viaHris.access as StoredRow[]);
}

export async function saveAccessRow(employeeNumber: string, role: AppRole, enabled: boolean, actor: string) {
  const direct = await withDb(async (connection) => {
    await ensureTable(connection);
    await connection.query(
      `INSERT INTO it_department_user_access (employee_number, role, enabled, updated_by, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE role = VALUES(role), enabled = VALUES(enabled),
         updated_by = VALUES(updated_by), updated_at = NOW()`,
      [employeeNumber.slice(0, 20), role, enabled ? 1 : 0, actor.slice(0, 160)],
    );
    return true;
  }).catch(() => null);
  if (direct) return;
  const viaHris = await callHris("user_access_save", {
    employee_number: employeeNumber.slice(0, 20),
    role,
    enabled,
    updated_by: actor.slice(0, 160),
  });
  if (!viaHris) throw new Error("Neither the HRIS database nor the HRMS endpoint is reachable");
}