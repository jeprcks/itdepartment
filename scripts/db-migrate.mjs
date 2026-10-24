// Idempotent migration: creates the IT Department tables and the `archived` column if missing.
// Never drops data. Usage: npm run db:migrate   (reads DB_* from .env)
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS } = process.env;
if (!DB_HOST || !DB_NAME || !DB_USER) {
  console.error("DB_HOST, DB_NAME and DB_USER must be set in .env");
  process.exit(1);
}
const connection = await mysql.createConnection({
  host: DB_HOST, port: Number(DB_PORT ?? 3306), database: DB_NAME, user: DB_USER, password: DB_PASS ?? "",
  multipleStatements: true,
});
try {
  const sql = readFileSync(new URL("../db/001_it_department_tables.sql", import.meta.url), "utf8");
  await connection.query(sql);
  const [cols] = await connection.query(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'it_department_projects' AND COLUMN_NAME = 'archived'",
  );
  if (Number(cols[0].n) === 0) {
    await connection.query("ALTER TABLE it_department_projects ADD COLUMN archived TINYINT NOT NULL DEFAULT 0");
    console.log("Added column it_department_projects.archived");
  }
  const has = async (table, kind, name) => {
    const sql = kind === "column"
      ? "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?"
      : "SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?";
    const [rows] = await connection.query(sql, [table, name]);
    return Number(rows[0].n) > 0;
  };
  if (!(await has("it_department_logs", "column", "project_id"))) {
    await connection.query("ALTER TABLE it_department_logs ADD COLUMN project_id VARCHAR(64) NULL DEFAULT NULL AFTER project_name");
    console.log("Added column it_department_logs.project_id");
  }
  if (!(await has("it_department_logs", "index", "idx_logs_project_id"))) {
    await connection.query("ALTER TABLE it_department_logs ADD INDEX idx_logs_project_id (project_id)");
    console.log("Added index it_department_logs.idx_logs_project_id");
  }
  // Backfill (002): only where the name matches exactly one project; ambiguous/unknown names stay NULL.
  const backfill = readFileSync(new URL("../db/002_logs_project_id.sql", import.meta.url), "utf8");
  const update = backfill.slice(backfill.indexOf("UPDATE it_department_logs"));
  const [res] = await connection.query(update);
  const [[stats]] = await connection.query(
    `SELECT COUNT(*) AS total, SUM(project_id IS NOT NULL) AS linked,
       SUM(project_id IS NULL AND TRIM(project_name) <> '') AS unlinked_named, SUM(TRIM(project_name) = '') AS no_name
     FROM it_department_logs`,
  );
  const [[amb]] = await connection.query(
    `SELECT COUNT(*) AS n FROM it_department_logs l WHERE l.project_id IS NULL AND LOWER(TRIM(l.project_name)) IN (
       SELECT k FROM (SELECT LOWER(TRIM(project_name)) AS k FROM it_department_projects) names GROUP BY k HAVING COUNT(*) > 1)`,
  );
  console.log(`Backfill: ${res.affectedRows} rows linked now; total ${stats.total}, linked ${stats.linked ?? 0}, ` +
    `unlinked with name ${stats.unlinked_named ?? 0} (ambiguous ${amb.n}), no project name ${stats.no_name ?? 0}`);
  const [[p]] = await connection.query("SELECT COUNT(*) AS n, SUM(archived = 1) AS a FROM it_department_projects");
  const [[l]] = await connection.query("SELECT COUNT(*) AS n FROM it_department_logs");
  console.log(`OK: ${DB_NAME} — projects: ${p.n} (${p.a ?? 0} archived), logs: ${l.n}`);
} finally {
  await connection.end();
}
