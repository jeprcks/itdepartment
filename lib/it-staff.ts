import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import { readHandshakeConfig, readSignedJson, signTimestampBody } from "@/lib/sso/handshake.ts";

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

function staffUrl(consumeUrl: string) {
  return consumeUrl.replace(/\/consume\/?$/, "/it-staff");
}

async function listItStaffFromHris(): Promise<ItStaff[]> {
  const config = readHandshakeConfig();
  if (!config) return [];
  const nonce = randomBytes(16).toString("hex");
  const raw = JSON.stringify({
    action: "it_staff",
    audience: "project_management",
    nonce,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetch(staffUrl(config.consumeUrl), {
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
  if (!verified.ok || verified.payload.success !== true || verified.payload.nonce !== nonce) return [];
  const staff = verified.payload.staff;
  if (!Array.isArray(staff)) return [];
  return staff.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; name?: unknown; title?: unknown };
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) return [];
    return [{ id: Number(row.id), name, title: typeof row.title === "string" ? row.title : "" }];
  });
}

export async function listItStaff(): Promise<ItStaff[]> {
  const host = process.env.DB_HOST;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  if (!host || !database || !user) return listItStaffFromHris();

  const codes = list(process.env.IT_PM_IT_DEPARTMENT_CODES, "IT,WISE");
  const names = list(process.env.IT_PM_IT_DEPARTMENT_NAMES, "IT,IT Department,Information Technology");
  let connection: mysql.Connection;
  try {
    connection = await mysql.createConnection({
      host,
      port: Number(process.env.DB_PORT ?? 3306),
      database,
      user,
      password: process.env.DB_PASS ?? "",
      connectTimeout: 4000,
    });
  } catch {
    return listItStaffFromHris();
  }
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
