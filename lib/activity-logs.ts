import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import { readHandshakeConfig, readSignedJson, signTimestampBody } from "@/lib/sso/handshake.ts";

export type ActivityLog = {
  id: string;
  message: string;
  time: string;
  at: string;
  actor: string;
  action: string;
  project: string;
  employee: string;
  detail: string;
};

const tableSql = `CREATE TABLE IF NOT EXISTS it_department_logs (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  actor VARCHAR(160) NOT NULL,
  action VARCHAR(40) NOT NULL,
  project_name VARCHAR(200) NOT NULL DEFAULT '',
  employee_name VARCHAR(160) NOT NULL DEFAULT '',
  detail TEXT NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

function mapRow(row: {
  id: string;
  actor: string;
  action: string;
  project_name: string;
  employee_name: string;
  detail: string;
  message: string;
  created_at: Date | string;
}): ActivityLog {
  const created = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    project: row.project_name,
    employee: row.employee_name,
    detail: row.detail,
    message: row.message,
    at: created.toISOString(),
    time: created.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

async function connect() {
  const host = process.env.DB_HOST;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  if (!host || !database || !user) return null;
  return mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT ?? 3306),
    database,
    user,
    password: process.env.DB_PASS ?? "",
    connectTimeout: 4000,
  });
}

async function logsFromHris(entry?: Omit<ActivityLog, "id" | "time" | "at">): Promise<ActivityLog[] | null> {
  const config = readHandshakeConfig();
  if (!config) return null;
  const nonce = randomBytes(16).toString("hex");
  const raw = JSON.stringify({
    action: entry ? "logs_save" : "logs_list",
    audience: "project_management",
    nonce,
    entry,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetch(config.consumeUrl.replace(/\/consume\/?$/, "/projects"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SSO-Timestamp": timestamp,
      "X-SSO-Signature": signTimestampBody(config.secret, timestamp, raw),
    },
    body: raw,
    cache: "no-store",
  });
  const responseRaw = await response.text();
  const verified = readSignedJson(
    config.secret,
    responseRaw,
    response.headers.get("x-sso-timestamp") ?? "",
    response.headers.get("x-sso-signature") ?? "",
    Number(timestamp),
  );
  if (!verified.ok || verified.payload.success !== true || verified.payload.nonce !== nonce) return null;
  return Array.isArray(verified.payload.logs)
    ? verified.payload.logs.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as ActivityLog;
        if (!row.id || !row.message) return [];
        return [row];
      })
    : [];
}

export async function listActivityLogs(): Promise<ActivityLog[]> {
  if (readHandshakeConfig()) return (await logsFromHris()) ?? [];
  const connection = await connect().catch(() => null);
  if (!connection) return (await logsFromHris()) ?? [];
  try {
    await connection.query(tableSql);
    const [rows] = await connection.query(
      `SELECT id, actor, action, project_name, employee_name, detail, message, created_at
       FROM it_department_logs ORDER BY created_at DESC LIMIT 200`,
    );
    return (rows as Parameters<typeof mapRow>[0][]).map(mapRow);
  } finally {
    await connection.end();
  }
}

export async function saveActivityLog(entry: Omit<ActivityLog, "id" | "time" | "at">): Promise<void> {
  if (readHandshakeConfig()) {
    const saved = await logsFromHris(entry);
    if (!saved) throw new Error("Log was not saved");
    return;
  }
  const connection = await connect().catch(() => null);
  if (!connection) {
    const saved = await logsFromHris(entry);
    if (!saved) throw new Error("Log was not saved");
    return;
  }
  try {
    await connection.query(tableSql);
    await connection.query(
      `INSERT INTO it_department_logs (id, actor, action, project_name, employee_name, detail, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        randomBytes(16).toString("hex"),
        entry.actor.slice(0, 160),
        entry.action.slice(0, 40),
        entry.project.slice(0, 200),
        entry.employee.slice(0, 160),
        entry.detail.slice(0, 2000),
        entry.message.slice(0, 500),
      ],
    );
  } finally {
    await connection.end();
  }
}
