import { listActivityLogs } from "@/lib/activity-logs.ts";
import { csvResponse, toCsv } from "@/lib/csv.ts";
import { filterLogs } from "@/lib/log-filters.ts";
import { getSession } from "@/lib/sso/session.ts";
import { ROLE_LABELS, isAppRole } from "@/lib/access-rules.ts";
import { isViewOnly } from "@/lib/sso/access.ts";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  // View only: on-screen reading only, no bulk download.
  if (isViewOnly(session.access)) return Response.json({ error: "View only accounts cannot export." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const logs = filterLogs(await listActivityLogs(), {
    project: params.get("project") ?? "",
    person: params.get("person") ?? "",
    action: params.get("action") ?? "",
    role: params.get("role") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  });
  const csv = toCsv(
    ["Time (ISO)", "Changed by", "Role", "Action", "Project", "Employee", "Detail", "Message"],
    logs.map((l) => [l.at, l.actor, isAppRole(l.actorRole) ? ROLE_LABELS[l.actorRole] : "", l.action, l.project, l.employee, l.detail, l.message]),
  );
  return csvResponse(`it-activity-logs-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
