import { listActivityLogs, saveActivityLog } from "@/lib/activity-logs.ts";
import { logsForProject } from "@/lib/log-filters.ts";
import { getSession } from "@/lib/sso/session.ts";

const ACTIONS = new Set([
  "Added",
  "Updated",
  "Status changed",
  "Assigned",
  "Removed",
  "Note added",
  "Note updated",
  "Deleted",
  "Archived",
  "Restored",
]);

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const all = await listActivityLogs();
  const logs = logsForProject(all, params.get("projectId") ?? "", params.get("project") ?? "");
  return Response.json({ logs });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    project?: unknown;
    projectId?: unknown;
    employee?: unknown;
    detail?: unknown;
    message?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!ACTIONS.has(action) || !message) {
    return Response.json({ error: "Invalid log" }, { status: 400 });
  }
  await saveActivityLog({
    actor: session.name,
    action,
    project: typeof body?.project === "string" ? body.project.trim() : "",
    projectId:
      typeof body?.projectId === "string" && /^[0-9a-f-]{36}$/i.test(body.projectId) ? body.projectId : "",
    employee: typeof body?.employee === "string" ? body.employee.trim() : "",
    detail: typeof body?.detail === "string" ? body.detail.trim() : "",
    message,
  });
  return Response.json({ ok: true });
}
