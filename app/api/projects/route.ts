import { archiveProject, listArchivedProjects, listProjects, restoreProject, saveProject, type StoredProject } from "@/lib/projects.ts";
import { getSession } from "@/lib/sso/session.ts";

function safeHttpUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return "";
  }
  return "";
}

function clean(body: unknown): StoredProject | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Partial<StoredProject>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const projectName = typeof row.projectName === "string" ? row.projectName.trim() : "";
  const deadline = typeof row.deadline === "string" ? row.deadline.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !name || !projectName || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    return null;
  }
  return {
    id,
    name,
    projectName,
    projectLink: safeHttpUrl(row.projectLink),
    trelloLink: safeHttpUrl(row.trelloLink),
    status: typeof row.status === "string" ? row.status : "Under Review",
    progress: Math.min(100, Math.max(0, Number(row.progress) || 0)),
    deadline,
    notes: typeof row.notes === "string" ? row.notes.trim() : "",
    assignees: Array.isArray(row.assignees)
      ? row.assignees.filter((item): item is string => typeof item === "string" && item.trim() !== "")
      : [],
  };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  const projects = archived ? await listArchivedProjects() : await listProjects();
  return Response.json({ projects });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { project?: unknown; id?: unknown } | null;
  if (typeof body?.id === "string" && !body.project) {
    if (!/^[0-9a-f-]{36}$/i.test(body.id)) {
      return Response.json({ error: "Invalid project" }, { status: 400 });
    }
    const restore = (body as { restore?: unknown }).restore === true;
    try {
      const projects = restore ? await restoreProject(body.id) : await archiveProject(body.id);
      return Response.json({ projects });
    } catch {
      return Response.json({ error: restore ? "Project was not restored" : "Project was not archived" }, { status: 502 });
    }
  }
  const project = clean(body?.project);
  if (!project) return Response.json({ error: "Invalid project" }, { status: 400 });
  try {
    const projects = await saveProject(project);
    return Response.json({ projects });
  } catch {
    return Response.json({ error: "Project was not saved" }, { status: 502 });
  }
}
