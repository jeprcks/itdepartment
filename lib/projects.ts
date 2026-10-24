import { randomBytes } from "node:crypto";
import type mysql from "mysql2/promise";
import { withDb } from "@/lib/db.ts";
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

const SELECT_COLUMNS =
  "SELECT id, owner_name, project_name, project_link, trello_link, status, progress, deadline, notes, assignees FROM it_department_projects";

async function rows(connection: mysql.Connection, archived: 0 | 1) {
  const [result] = await connection.query(
    `${SELECT_COLUMNS} WHERE archived = ? ORDER BY updated_at DESC`,
    [archived],
  );
  return (result as Parameters<typeof mapRow>[0][]).map(mapRow);
}

async function hrisOrThrow(
  action: Parameters<typeof projectsFromHris>[0],
  extra: Parameters<typeof projectsFromHris>[1],
  error: string,
) {
  const result = await projectsFromHris(action, extra).catch(() => null);
  if (!result) throw new Error(error);
  return result;
}

/**
 * Storage: MySQL (DB_* in .env, same tables as HRMS) is the source of truth.
 * If the DB is not configured or unreachable, fall back to the signed HRMS projects endpoint.
 */
export async function listProjects(): Promise<StoredProject[]> {
  const fromDb = await withDb((connection) => rows(connection, 0)).catch(() => null);
  return fromDb ?? (await projectsFromHris().catch(() => null)) ?? [];
}

export async function listArchivedProjects(): Promise<StoredProject[]> {
  const fromDb = await withDb((connection) => rows(connection, 1)).catch(() => null);
  return fromDb ?? (await projectsFromHris("projects_archived").catch(() => null)) ?? [];
}

/** Stored row (active or archived) used for server-side ownership checks. */
export async function findProject(id: string): Promise<(StoredProject & { archived: boolean }) | null> {
  const fromDb = await withDb(async (connection) => {
    const [result] = await connection.query(`${SELECT_COLUMNS.replace("assignees FROM", "assignees, archived FROM")} WHERE id = ? LIMIT 1`, [id]);
    const row = (result as (Parameters<typeof mapRow>[0] & { archived: number })[])[0];
    return row ? { ...mapRow(row), archived: Number(row.archived) === 1 } : false;
  }).catch(() => null);
  if (fromDb !== null) return fromDb || null;
  const active = await projectsFromHris().catch(() => null);
  const hit = active?.find((project) => project.id === id);
  if (hit) return { ...hit, archived: false };
  const archived = await projectsFromHris("projects_archived").catch(() => null);
  const old = archived?.find((project) => project.id === id);
  return old ? { ...old, archived: true } : null;
}

export async function saveProject(project: StoredProject): Promise<StoredProject[]> {
  const fromDb = await withDb(async (connection) => {
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
        project.name.slice(0, 160),
        project.projectName.slice(0, 200),
        project.projectLink.slice(0, 500),
        project.trelloLink.slice(0, 500),
        project.status.slice(0, 40),
        project.progress,
        project.deadline,
        project.notes,
        JSON.stringify(project.assignees),
      ],
    );
    return rows(connection, 0);
  });
  return fromDb ?? hrisOrThrow("projects_save", { project }, "Project was not saved");
}

async function setArchived(id: string, archived: 0 | 1) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid project");
  const fromDb = await withDb(async (connection) => {
    await connection.query(
      "UPDATE it_department_projects SET archived = ?, updated_at = NOW() WHERE id = ?",
      [archived, id],
    );
    return rows(connection, archived === 1 ? 0 : 1);
  });
  return (
    fromDb ??
    hrisOrThrow(archived ? "projects_delete" : "projects_restore", { id }, archived ? "Project was not archived" : "Project was not restored")
  );
}

export const archiveProject = (id: string) => setArchived(id, 1);
export const restoreProject = (id: string) => setArchived(id, 0);
