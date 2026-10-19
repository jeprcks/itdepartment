import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SSO_AUDIENCE = "project_management";

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
};

export function readHandshakeConfig(
  env: Record<string, string | undefined> = process.env,
): HandshakeConfig | null {
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
  if (typeof record.employee_number !== "string" || record.employee_number.trim() === "") {
    return null;
  }
  return {
    employeeNumber: record.employee_number,
    displayName: typeof record.display_name === "string" ? record.display_name : record.employee_number,
    email: typeof record.email === "string" ? record.email : "",
    hrmsUserId: typeof record.hrms_user_id === "number" ? record.hrms_user_id : 0,
  };
}

export function issueSessionCookie(secret: string, claims: EmployeeClaims, nowSeconds: number, secure: boolean) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: claims.employeeNumber,
      name: claims.displayName,
      exp: nowSeconds + 60 * 60 * 8,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return {
    name: "it_pm_session" as const,
    value: `${payload}.${signature}`,
    httpOnly: true as const,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}

export async function consumeHrisToken(
  token: string,
  config: HandshakeConfig,
  fetchImpl: typeof fetch = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!/^[0-9a-f]{64}$/i.test(token)) {
    return { ok: false as const, reason: "malformed" };
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
    return { ok: false as const, reason: "unreachable" };
  }
  const responseRaw = await response.text();
  const verified = readSignedJson(
    config.secret,
    responseRaw,
    response.headers.get("x-sso-timestamp") ?? "",
    response.headers.get("x-sso-signature") ?? "",
    nowSeconds,
  );
  if (!verified.ok || !response.ok) {
    return { ok: false as const, reason: verified.ok ? "rejected" : verified.reason };
  }
  const claims = claimsFromPayload(verified.payload, nonce);
  if (!claims) return { ok: false as const, reason: "unknown-user" };
  return {
    ok: true as const,
    claims,
    cookie: issueSessionCookie(config.secret, claims, nowSeconds, process.env.NODE_ENV === "production"),
  };
}
