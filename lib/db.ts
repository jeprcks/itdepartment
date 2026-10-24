import mysql from "mysql2/promise";

/** Projects + logs tables. Same schema HRMS uses, so both apps share data in DB_NAME. */
export const PROJECTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS it_department_projects (
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
)`;

export const LOGS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS it_department_logs (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  actor VARCHAR(160) NOT NULL,
  action VARCHAR(40) NOT NULL,
  project_name VARCHAR(200) NOT NULL DEFAULT '',
  project_id VARCHAR(64) NULL DEFAULT NULL,
  employee_name VARCHAR(160) NOT NULL DEFAULT '',
  detail TEXT NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export function dbConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.DB_HOST && env.DB_NAME && env.DB_USER);
}

export async function connectDb() {
  if (!dbConfigured()) return null;
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS ?? "",
    connectTimeout: 4000,
    dateStrings: ["DATE"],
  });
}

let ensured = false;

/** Idempotent: creates missing tables/columns, never drops or rewrites data. */
export async function ensureSchema(connection: mysql.Connection) {
  if (ensured) return;
  await connection.query(PROJECTS_TABLE_SQL);
  await connection.query(LOGS_TABLE_SQL);
  const [cols] = await connection.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'it_department_projects' AND COLUMN_NAME = 'archived'`,
  );
  if (Number((cols as { n: number }[])[0]?.n ?? 0) === 0) {
    await connection.query("ALTER TABLE it_department_projects ADD COLUMN archived TINYINT NOT NULL DEFAULT 0");
  }
  const [logCols] = await connection.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'it_department_logs' AND COLUMN_NAME = 'project_id'`,
  );
  if (Number((logCols as { n: number }[])[0]?.n ?? 0) === 0) {
    await connection.query(
      "ALTER TABLE it_department_logs ADD COLUMN project_id VARCHAR(64) NULL DEFAULT NULL AFTER project_name",
    );
  }
  const [logIdx] = await connection.query(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'it_department_logs' AND INDEX_NAME = 'idx_logs_project_id'`,
  );
  if (Number((logIdx as { n: number }[])[0]?.n ?? 0) === 0) {
    await connection.query("ALTER TABLE it_department_logs ADD INDEX idx_logs_project_id (project_id)");
  }
  ensured = true;
}

/** Runs fn with a connection, or returns null when the DB is not configured/reachable. */
export async function withDb<T>(fn: (connection: mysql.Connection) => Promise<T>): Promise<T | null> {
  const connection = await connectDb().catch(() => null);
  if (!connection) return null;
  try {
    await ensureSchema(connection);
    return await fn(connection);
  } finally {
    await connection.end().catch(() => undefined);
  }
}
