import { listStaffNotifications, markStaffNotificationsRead, saveStaffNotification } from "@/lib/staff-notifications.ts";
import { getSession } from "@/lib/sso/session.ts";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const notifications = await listStaffNotifications(session.name);
  return Response.json({ notifications });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    recipient?: unknown;
    message?: unknown;
  } | null;
  if (body && (body as { read?: unknown }).read === true) {
    await markStaffNotificationsRead(session.name);
    return Response.json({ ok: true });
  }
  const recipient = typeof body?.recipient === "string" ? body.recipient : "";
  const message = typeof body?.message === "string" ? body.message : "";
  if (!recipient || !message) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  await saveStaffNotification({ recipient, actor: session.name, message });
  return Response.json({ ok: true });
}
