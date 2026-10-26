import { saveActivityLog } from "@/lib/activity-logs.ts";
import { ROLE_LABELS, assignableRoles, authorizeAccessChange, canManageUsers, isAppRole } from "@/lib/access-rules.ts";
import { listManagedUsers, saveAccessRow } from "@/lib/user-access.ts";
import { getSession } from "@/lib/sso/session.ts";

async function superAdmin() {
  const session = await getSession();
  if (!session) return { error: Response.json({ error: "Not signed in" }, { status: 401 }) };
  if (!canManageUsers(session.access)) return { error: Response.json({ error: "Super Admin or Admin only" }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const { session, error } = await superAdmin();
  if (!session) return error;
  const users = await listManagedUsers().catch(() => null);
  if (!users) return Response.json({ error: "The HRIS database is not reachable." }, { status: 503 });
  return Response.json({
    users: users.map((user) => ({ ...user, assignable: assignableRoles(session.access, user.employeeNumber) })),
    me: session.sub,
  });
}

export async function PATCH(request: Request) {
  const { session, error } = await superAdmin();
  if (!session) return error;
  const body = (await request.json().catch(() => null)) as { employeeNumber?: unknown; role?: unknown; enabled?: unknown } | null;
  const employeeNumber = typeof body?.employeeNumber === "string" ? body.employeeNumber.trim() : "";
  const users = await listManagedUsers().catch(() => null);
  if (!users) return Response.json({ error: "The HRIS database is not reachable." }, { status: 503 });
  const before = users.find((user) => user.employeeNumber.toLowerCase() === employeeNumber.toLowerCase());
  if (!before) return Response.json({ error: "Employee not found in HRIS." }, { status: 404 });

  // Keep the stored role when only enabling/disabling; a disabled "none" row stays "none".
  const role = isAppRole(body?.role) ? body.role : before.assignedRole;
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : before.enabled;
  const decision = authorizeAccessChange(session, { employeeNumber: before.employeeNumber, role, enabled });
  if (!decision.ok) return Response.json({ error: decision.error }, { status: decision.status });

  await saveAccessRow(before.employeeNumber, role, enabled, session.name);

  const changes: string[] = [];
  const beforeRole = before.source === "bootstrap" ? before.access : before.assignedRole;
  const who = `${session.name} (${ROLE_LABELS[session.access]})`;
  if (beforeRole !== role) changes.push(`Role: ${ROLE_LABELS[beforeRole]} → ${ROLE_LABELS[role]}`);
  if (before.enabled !== enabled) changes.push(enabled ? "Access enabled" : "Access disabled");
  if (changes.length === 0) changes.push(`Role confirmed: ${ROLE_LABELS[role]}`);
  const action = before.enabled !== enabled ? (enabled ? "Access enabled" : "Access disabled") : "Role changed";
  await saveActivityLog({
    actor: session.name,
    actorRole: session.access,
    action,
    project: "",
    projectId: "",
    employee: before.name,
    detail: changes.join("; "),
    message: `${who} updated IT Department access for ${before.name} (${before.employeeNumber}): ${changes.join("; ")}.`,
  }).catch(() => undefined);

  const after = (await listManagedUsers().catch(() => null))?.find((user) => user.employeeNumber === before.employeeNumber);
  return Response.json({ ok: true, user: after ?? null });
}