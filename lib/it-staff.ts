import mysql from "mysql2/promise";

export type ItStaff = {
  id: number;
  name: string;
  title: string;
};

function list(raw: string | undefined, fallback: string) {
  return (raw ?? fallback)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export async function listItStaff(): Promise<ItStaff[]> {
  const host = process.env.DB_HOST;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  if (!host || !database || !user) return [];

  const codes = list(process.env.IT_PM_IT_DEPARTMENT_CODES, "IT,WISE");
  const names = list(process.env.IT_PM_IT_DEPARTMENT_NAMES, "IT,IT Department,Information Technology");
  const connection = await mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT ?? 3306),
    database,
    user,
    password: process.env.DB_PASS ?? "",
  });
  try {
    const [rows] = await connection.query(
      `SELECT e.id,
              TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS name,
              COALESCE(p.title, '') AS title
       FROM employees e
       LEFT JOIN positions p ON p.id = e.position_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE e.deleted_at IS NULL
         AND e.is_active = 1
         AND e.date_separated IS NULL
         AND (
           LOWER(d.code) IN (?)
           OR LOWER(d.name) IN (?)
         )
       ORDER BY e.last_name, e.first_name`,
      [codes, names],
    );
    return (rows as { id: number; name: string; title: string }[]).map((row) => ({
      id: Number(row.id),
      name: row.name,
      title: row.title,
    }));
  } finally {
    await connection.end();
  }
}
