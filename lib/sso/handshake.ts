import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { resolveAccess, type AccessLevel } from "./access.ts";

export const SSO_AUDIENCE = "project_management";
export const SESSION_COOKIE = "it_pm_session";
export const DEFAULT_SESSION_SECONDS = 2 * 60 * 60;

export type HandshakeConfig = {
  consumeUrl: string;
  secret: string;
  allowedPaths: string[];
};

export type EmployeeClaims = {
  employeeNumber: string;
  displayName: string;
  email: string;
  hrmsUserId: number;
  accountType: string;
  position: string;
  departmentCode: string;
  departmentName: string;
};

export type SessionProfile = {
  sub: string;
  hrmsUserId: number;
  name: string;
  accountType: string;
  position: string;
  departmentCode: string;
  departmentName: string;
  access: AccessLevel;
  exp: number;
};

type Env = Record<string, string | undefined>;

export function ssoEnabled(env: Env = process.env) {
  return env.HRIS_SSO_ENABLED === "true";
}

export function readHandshakeConfig(env: Env = process.env): HandshakeConfig | null {
  if (!ssoEnabled(env)) return null;
  const secret = env.HRIS_SSO_SECRET ?? "";
  const consumeUrl = env.HRIS_SSO_CONSUME_URL ?? "";
  if (secret.length < 32 || consumeUrl === "") return null;
  const allowed = (env.HRIS_SSO_ALLOWED_PATHS ?? "/")
    .split(",")
    .map((path) => path.trim())
    .filter((path) => path.startsWith("/") && !path.startsWith("//"));
  return {
    consumeUrl,
    secret,
    allowedPaths: allowed.length > 0 ? allowed : ["/"],
  };
}

/** Cookie signing secret. Must differ from the HRMS handshake secret. */
export function readSessionSecret(env: Env = process.env) {
  const secret = env.IT_PM_SESSION_SECRET ?? "";
  if (secret.length < 32) return "";
  if (secret === (env.HRIS_SSO_SECRET ?? "")) return "";
  return secret;
}

export function readSessionSeconds(env: Env = process.env) {
  const value = Number(env.IT_PM_SESSION_MAX_AGE_SECONDS ?? DEFAULT_SESSION_SECONDS);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SESSION_SECONDS;
  return Math.min(Math.max(Math.floor(value), 300), 8 * 60 * 60);
}

export function hrmsDashboardUrl(env: Env = process.env) {
  const raw = (env.HRIS_DASHBOARD_URL ?? "").trim();
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    // fall through
  }
  return "";
}

export function signTimestampBody(secret: string, timestamp: string, raw: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
}

export function buildConsumeBody(token: string, nonce: string) {
  return JSON.stringify({
    token: token.toLowerCase(),
    nonce,
    audience: SSO_AUDIENCE,
  });
}

export function safeNextPath(raw: string, allowedPaths: string[]) {
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) {
    return "/";
  }
  return allowedPaths.includes(raw) ? raw : "/";
}

function signaturesMatch(actual: string, expected: string) {
  const left = Buffer.from(actual.toLowerCase(), "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function readSignedJson(
  secret: string,
  raw: string,
  timestamp: string,
  signature: string,
  nowSeconds: number,
  maxSkewSeconds = 60,
): { ok: true; payload: Record<string, unknown> } | { ok: false; reason: string } {
  if (!/^\d+$/.test(timestamp) || !/^[0-9a-f]+$/i.test(signature)) {
    return { ok: false, reason: "invalid-signature" };
  }
  if (Math.abs(nowSeconds - Number(timestamp)) > maxSkewSeconds) {
    return { ok: false, reason: "expired" };
  }
  const expected = signTimestampBody(secret, timestamp, raw);
  if (!signaturesMatch(signature, expected)) {
    return { ok: false, reason: "invalid-signature" };
  }
  try {
    const payload = JSON.parse(raw) as unknown;
    if (!payload || typeof payload !== "object") {
      return { ok: false, reason: "malformed" };
    }
    return { ok: true, payload: payload as Record<string, unknown> };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function claimsFromPayload(
  payload: Record<string, unknown>,
  nonce: string,
): EmployeeClaims | null {
  if (payload.success !== true || payload.audience !== SSO_AUDIENCE || payload.nonce !== nonce) {
    return null;
  }
  const user = payload.user;
  if (!user || typeof user !== "object") return null;
  const record = user as Record<string, unknown>;
  if (record.is_active !== true) return null;
  const employeeNumber = str(record.employee_number);
  if (employeeNumber === "") return null;
  return {
    employeeNumber,
    displayName: str(record.display_name) || employeeNumber,
    email: str(record.email),
    hrmsUserId: typeof record.hrms_user_id === "number" ? record.hrms_user_id : 0,
    accountType: str(record.hrms_role),
    position: str(record.position_title),
    departmentCode: str(record.department_code),
    departmentName: str(record.department_name),
  };
}

function hmac(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueSessionCookie(
  sessionSecret: string,
  claims: EmployeeClaims,
  access: AccessLevel,
  nowSeconds: number,
  secure: boolean,
  maxAge = DEFAULT_SESSION_SECONDS,
) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: claims.employeeNumber,
      uid: claims.hrmsUserId,
      name: claims.displayName,
      accountType: claims.accountType,
      position: claims.position,
      deptCode: claims.departmentCode,
      deptName: claims.departmentName,
      access,
      exp: nowSeconds + maxAge,
    }),
  ).toString("base64url");
  return {
    name: SESSION_COOKIE,
    value: `${payload}.${hmac(sessionSecret, payload)}`,
    httpOnly: true as const,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

const ACCESS_LEVELS: AccessLevel[] = ["super_admin", "admin", "president", "it_staff", "viewer"];

/** Verifies signature AND expiry. Returns null for anything invalid. */
export function readSessionProfile(
  cookieValue: string | undefined,
  sessionSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SessionProfile | null {
  if (!cookieValue || sessionSecret.length < 32) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = cookieValue.slice(0, dot);
  const left = Buffer.from(cookieValue.slice(dot + 1));
  const right = Buffer.from(hmac(sessionSecret, payload));
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof data.exp !== "number" || data.exp <= nowSeconds) return null;
    const name = str(data.name);
    const sub = str(data.sub);
    const access = data.access as AccessLevel;
    if (name === "" || sub === "" || !ACCESS_LEVELS.includes(access)) return null;
    return {
      sub,
      hrmsUserId: typeof data.uid === "number" ? data.uid : 0,
      name,
      accountType: str(data.accountType),
      position: str(data.position),
      departmentCode: str(data.deptCode),
      departmentName: str(data.deptName),
      access,
      exp: data.exp,
    };
  } catch {
    return null;
  }
}

export type ConsumeResult =
  | { ok: true; claims: EmployeeClaims }
  | { ok: false; reason: string };

export async function consumeHrisToken(
  token: string,
  config: HandshakeConfig,
  fetchImpl: typeof fetch = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<ConsumeResult> {
  if (!/^[0-9a-f]{64}$/i.test(token)) {
    return { ok: false, reason: "malformed" };
  }
  const nonce = randomBytes(16).toString("hex");
  const raw = buildConsumeBody(token, nonce);
  const timestamp = String(nowSeconds);
  const signature = signTimestampBody(config.secret, timestamp, raw);
  let response: Response;
  try {
    response = await fetchImpl(config.consumeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SSO-Timestamp": timestamp,
        "X-SSO-Signature": signature,
      },
      body: raw,
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  const responseRaw = await response.text();
  const verified = readSignedJson(
    config.secret,
    responseRaw,
    response.headers.get("x-sso-timestamp") ?? "",
    response.headers.get("x-sso-signature") ?? "",
    nowSeconds,
  );
  if (!verified.ok) return { ok: false, reason: verified.reason };
  if (!response.ok) return { ok: false, reason: "rejected" };
  const claims = claimsFromPayload(verified.payload, nonce);
  if (!claims) return { ok: false, reason: "rejected" };
  return { ok: true, claims };
}

export { resolveAccess };
