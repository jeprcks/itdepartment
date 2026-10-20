import { listProjects, saveProject, type StoredProject } from "@/lib/projects.ts";
import { getSession } from "@/lib/sso/session.ts";

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
    projectLink: typeof row.projectLink === "string" ? row.projectLink.trim() : "",
    trelloLink: typeof row.trelloLink === "string" ? row.trelloLink.trim() : "",
    status: typeof row.status === "string" ? row.status : "Not started",
    progress: Math.min(100, Math.max(0, Number(row.progress) || 0)),
    deadline,
    notes: typeof row.notes === "string" ? row.notes.trim() : "",
    assignees: Array.isArray(row.assignees)
      ? row.assignees.filter((item): item is string => typeof item === "string" && item.trim() !== "")
      : [],
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const projects = await listProjects();
  return Response.json({ projects });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { project?: unknown } | null;
  const project = clean(body?.project);
  if (!project) return Response.json({ error: "Invalid project" }, { status: 400 });
  try {
    const projects = await saveProject(project);
    return Response.json({ projects });
  } catch {
    return Response.json({ error: "Project was not saved" }, { status: 502 });
  }
}
