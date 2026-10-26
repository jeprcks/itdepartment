import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { canManageUsers, effectiveAccess } from "../access-rules.ts";
import { readAccessRow } from "../user-access.ts";
import {
  SESSION_COOKIE,
  readSessionProfile,
  readSessionSecret,
  type SessionProfile,
} from "./handshake.ts";

const CACHE_MS = 5000;
const cache = new Map<string, { at: number; profile: SessionProfile | null }>();

/**
 * Re-applies the admin's decision (it_department_user_access) on every request, so a role change or
 * disable takes effect within a few seconds instead of when the 2h cookie expires.
 * If the DB is unreachable the signed cookie access is kept (no lock-out on DB outages).
 * Returns null when the admin has removed or disabled this user's access.
 */
export async function applyAccessDecision(profile: SessionProfile): Promise<SessionProfile | null> {
  const key = `${profile.sub}|${profile.access}|${profile.exp}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.profile;
  const row = await readAccessRow(profile.sub);
  let result: SessionProfile | null = profile;
  if (row !== undefined) {
    const decided = effectiveAccess(profile.sub, profile.access, row);
    result = decided.access === "none" ? null : { ...profile, access: decided.access };
  }
  cache.set(key, { at: Date.now(), profile: result });
  if (cache.size > 500) cache.clear();
  return result;
}

async function readState(): Promise<{ signedIn: boolean; session: SessionProfile | null }> {
  await connection();
  const store = await cookies();
  const profile = readSessionProfile(store.get(SESSION_COOKIE)?.value, readSessionSecret());
  if (!profile) return { signedIn: false, session: null };
  return { signedIn: true, session: await applyAccessDecision(profile) };
}

/** Server-side session read for pages, route handlers and server actions. */
export async function getSession(): Promise<SessionProfile | null> {
  return (await readState()).session;
}

/** Use in every page/server action as defence in depth (proxy also checks). */
export async function requireSession(): Promise<SessionProfile> {
  const { signedIn, session } = await readState();
  if (!session) redirect(signedIn ? "/access-denied?reason=noaccess" : "/access-denied?reason=signin");
  return session;
}

/** User Management: Super Admin and Admin only. */
export async function requireUserManager(): Promise<SessionProfile> {
  const session = await requireSession();
  if (!canManageUsers(session.access)) redirect("/access-denied?reason=forbidden");
  return session;
}

/** Super Admin only pages. */
export async function requireSuperAdmin(): Promise<SessionProfile> {
  const session = await requireSession();
  if (session.access !== "super_admin") redirect("/access-denied?reason=forbidden");
  return session;
}