import { randomBytes } from "node:crypto";
import { withDb } from "@/lib/db.ts";
import { readHandshakeConfig, readSignedJson, signTimestampBody } from "@/lib/sso/handshake.ts";

export type ActivityLog = {
  id: string;
  message: string;
  time: string;
  at: string;
  actor: string;
  action: string;
  project: string;
  /** it_department_projects.id; empty for old rows / HRMS-written rows. */
  projectId: string;
  employee: string;
  detail: string;
};

function mapRow(row: {
  id: string;
  actor: string;
  action: string;
  project_name: string;
  project_id?: string | null;
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
    projectId: row.project_id ?? "",
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
        return [{ ...row, projectId: typeof row.projectId === "string" ? row.projectId : "" }];
      })
    : [];
}

export const LOG_LIMIT = 2000;

/** MySQL first (DB_* in .env); falls back to the signed HRMS endpoint (latest 200 only). */
export async function listActivityLogs(): Promise<ActivityLog[]> {
  const fromDb = await withDb(async (connection) => {
    const [rows] = await connection.query(
      `SELECT id, actor, action, project_name, project_id, employee_name, detail, message, created_at
       FROM it_department_logs ORDER BY created_at DESC LIMIT ${LOG_LIMIT}`,
    );
    return (rows as Parameters<typeof mapRow>[0][]).map(mapRow);
  }).catch(() => null);
  return fromDb ?? (await logsFromHris().catch(() => null)) ?? [];
}

export async function saveActivityLog(entry: Omit<ActivityLog, "id" | "time" | "at">): Promise<void> {
  const saved = await withDb(async (connection) => {
    await connection.query(
      `INSERT INTO it_department_logs (id, actor, action, project_name, project_id, employee_name, detail, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        randomBytes(16).toString("hex"),
        entry.actor.slice(0, 160),
        entry.action.slice(0, 40),
        entry.project.slice(0, 200),
        /^[0-9a-f-]{36}$/i.test(entry.projectId) ? entry.projectId : null,
        entry.employee.slice(0, 160),
        entry.detail.slice(0, 2000),
        entry.message.slice(0, 500),
      ],
    );
    return true;
  }).catch(() => null);
  if (saved) return;
  const viaHris = await logsFromHris(entry).catch(() => null);
  if (!viaHris) throw new Error("Log was not saved");
}
