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
  const [[p]] = await connection.query("SELECT COUNT(*) AS n, SUM(archived = 1) AS a FROM it_department_projects");
  const [[l]] = await connection.query("SELECT COUNT(*) AS n FROM it_department_logs");
  console.log(`OK: ${DB_NAME} — projects: ${p.n} (${p.a ?? 0} archived), logs: ${l.n}`);
} finally {
  await connection.end();
}
