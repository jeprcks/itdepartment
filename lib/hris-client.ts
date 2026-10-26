import { randomBytes } from "node:crypto";
import { readHandshakeConfig, readSignedJson, signTimestampBody } from "@/lib/sso/handshake.ts";

/**
 * Signed call to HRMS /api/sso/project-management/projects (same HMAC secret as SSO).
 * Used when this app cannot reach MySQL directly (e.g. Vercel -> cPanel). Null on any failure.
 */
export async function callHris(action: string, extra: Record<string, unknown> = {}): Promise<Record<string, unknown> | null> {
  const config = readHandshakeConfig();
  if (!config) return null;
  const nonce = randomBytes(16).toString("hex");
  const raw = JSON.stringify({ ...extra, action, audience: "project_management", nonce });
  const timestamp = String(Math.floor(Date.now() / 1000));
  try {
    const response = await fetch(config.consumeUrl.replace(/\/consume\/?$/, "/projects"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SSO-Timestamp": timestamp,
        "X-SSO-Signature": signTimestampBody(config.secret, timestamp, raw),
      },
      body: raw,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const verified = readSignedJson(
      config.secret,
      await response.text(),
      response.headers.get("x-sso-timestamp") ?? "",
      response.headers.get("x-sso-signature") ?? "",
      Number(timestamp),
    );
    if (!verified.ok || verified.payload.success !== true || verified.payload.nonce !== nonce) return null;
    return verified.payload;
  } catch {
    return null;
  }
}