import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import { readHandshakeConfig, readSignedJson, signTimestampBody } from "@/lib/sso/handshake.ts";

export type StoredProject = {
  id: string;
  name: string;
  projectName: string;
  projectLink: string;
  trelloLink: string;
  status: string;
  progress: number;
  deadline: string;
  notes: string;
  assignees: string[];
};

const tableSql = `CREATE TABLE IF NOT EXISTS it_department_projects (
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

function mapRow(row: {
  id: string;
  owner_name: string;
  project_name: string;
  project_link: string;
  trello_link: string;
  status: string;
  progress: number;
  deadline: Date | string;
  notes: string;
  assignees: string;
}): StoredProject {
  let assignees: string[] = [];
  try {
    const parsed = JSON.parse(row.assignees) as unknown;
    if (Array.isArray(parsed)) {
      assignees = parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    assignees = [];
  }
  const deadline = row.deadline instanceof Date
    ? row.deadline.toISOString().slice(0, 10)
    : String(row.deadline).slice(0, 10);
  return {
    id: row.id,
    name: row.owner_name,
    projectName: row.project_name,
    projectLink: row.project_link,
    trelloLink: row.trello_link,
    status: row.status,
    progress: Number(row.progress),
    deadline,
    notes: row.notes,
    assignees,
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

async function projectsFromHris(
  action: "projects_list" | "projects_save" | "projects_delete" | "projects_restore" | "projects_archived" = "projects_list",
  extra: { project?: StoredProject; id?: string } = {},
): Promise<StoredProject[] | null> {
  const config = readHandshakeConfig();
  if (!config) return null;
  const nonce = randomBytes(16).toString("hex");
  const raw = JSON.stringify({
    action,
    audience: "project_management",
    nonce,
    project: extra.project,
    id: extra.id,
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
  return Array.isArray(verified.payload.projects)
    ? verified.payload.projects.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as StoredProject;
        if (!row.id || !row.projectName) return [];
        return [{ ...row, assignees: Array.isArray(row.assignees) ? row.assignees : [] }];
      })
    : [];
}

export async function listProjects(): Promise<StoredProject[]> {
  if (readHandshakeConfig()) return (await projectsFromHris()) ?? [];
  const connection = await connect().catch(() => null);
  if (!connection) return (await projectsFromHris()) ?? [];
  try {
    await connection.query(tableSql);
    const [rows] = await connection.query(
      `SELECT id, owner_name, project_name, project_link, trello_link, status, progress, deadline, notes, assignees
       FROM it_department_projects WHERE archived = 0 ORDER BY updated_at DESC`,
    );
    return (rows as Parameters<typeof mapRow>[0][]).map(mapRow);
  } finally {
    await connection.end();
  }
}

export async function saveProject(project: StoredProject): Promise<StoredProject[]> {
  if (readHandshakeConfig()) {
    const saved = await projectsFromHris("projects_save", { project });
    if (!saved) throw new Error("Project was not saved");
    return saved;
  }
  const connection = await connect().catch(() => null);
  if (!connection) {
    const saved = await projectsFromHris("projects_save", { project });
    if (!saved) throw new Error("Project was not saved");
    return saved;
  }
  try {
    await connection.query(tableSql);
    await connection.query(
      `INSERT INTO it_department_projects
        (id, owner_name, project_name, project_link, trello_link, status, progress, deadline, notes, assignees, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        owner_name = VALUES(owner_name),
        project_name = VALUES(project_name),
        project_link = VALUES(project_link),
        trello_link = VALUES(trello_link),
        status = VALUES(status),
        progress = VALUES(progress),
        deadline = VALUES(deadline),
        notes = VALUES(notes),
        assignees = VALUES(assignees),
        updated_at = NOW()`,
      [
        project.id,
        project.name,
        project.projectName,
        project.projectLink,
        project.trelloLink,
        project.status,
        project.progress,
        project.deadline,
        project.notes,
        JSON.stringify(project.assignees),
      ],
    );
    const [rows] = await connection.query(
      `SELECT id, owner_name, project_name, project_link, trello_link, status, progress, deadline, notes, assignees
       FROM it_department_projects WHERE archived = 0 ORDER BY updated_at DESC`,
    );
    return (rows as Parameters<typeof mapRow>[0][]).map(mapRow);
  } finally {
    await connection.end();
  }
}

export async function archiveProject(id: string): Promise<StoredProject[]> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid project");
  const saved = await projectsFromHris("projects_delete", { id });
  if (!saved) throw new Error("Project was not archived");
  return saved;
}

export async function listArchivedProjects(): Promise<StoredProject[]> {
  return (await projectsFromHris("projects_archived")) ?? [];
}

export async function restoreProject(id: string): Promise<StoredProject[]> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid project");
  const saved = await projectsFromHris("projects_restore", { id });
  if (!saved) throw new Error("Project was not restored");
  return saved;
}
