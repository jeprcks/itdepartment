import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  SESSION_COOKIE,
  hrmsDashboardUrl,
  readSessionProfile,
  readSessionSecret,
  type SessionProfile,
} from "./handshake.ts";

/** Server-side session read for pages, route handlers and server actions. */
export async function getSession(): Promise<SessionProfile | null> {
  await connection();
  const store = await cookies();
  return readSessionProfile(store.get(SESSION_COOKIE)?.value, readSessionSecret());
}

/** Use in every page/server action as defence in depth (proxy also checks). */
export async function requireSession(): Promise<SessionProfile> {
  const session = await getSession();
  if (!session) redirect(hrmsDashboardUrl() || "/access-denied?reason=signin");
  return session;
}
