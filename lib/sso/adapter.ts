import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readSsoConfig, type SsoConfig } from "./config.ts";
import type {
  LocalUser,
  ParsedSsoRequest,
  SessionCookie,
  SessionRecord,
  SsoFailure,
} from "./types.ts";

export type SsoDependencies = {
  config?: SsoConfig;
  now?: () => number;
  users?: Map<string, LocalUser>;
  consumedNonces?: Set<string>;
  sessions?: Map<string, SessionRecord>;
};

export function parseSsoRequest(body: unknown): ParsedSsoRequest | SsoFailure {
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "malformed" };
  }
  const record = body as Record<string, unknown>;
  const timestamp = Number(record.timestamp);
  const signature = typeof record.signature === "string" ? record.signature : "";
  if (
    typeof record.issuer !== "string" ||
    typeof record.audience !== "string" ||
    typeof record.employeeId !== "string" ||
    typeof record.nonce !== "string" ||
    !Number.isFinite(timestamp) ||
    !/^[0-9a-f]+$/i.test(signature) ||
    signature.length % 2 !== 0
  ) {
    return { ok: false, reason: "malformed" };
  }
  return {
    issuer: record.issuer,
    audience: record.audience,
    employeeId: record.employeeId,
    nonce: record.nonce,
    timestamp,
    signature,
  };
}

export function validateTimestamp(
  timestamp: number,
  maxAgeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): SsoFailure | { ok: true } {
  if (!Number.isFinite(timestamp) || maxAgeSeconds <= 0) {
    return { ok: false, reason: "expired" };
  }
  if (Math.abs(nowSeconds - timestamp) > maxAgeSeconds) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

export function claimNonce(
  nonce: string,
  consumed: Set<string>,
): SsoFailure | { ok: true } {
  if (!nonce || consumed.has(nonce)) {
    return { ok: false, reason: "replayed" };
  }
  consumed.add(nonce);
  return { ok: true };
}

export function verifySignature(
  config: SsoConfig,
  _request: ParsedSsoRequest,
): SsoFailure | { ok: true } {
  if (!config.protocolConfirmed || !config.enabled || !config.secret) {
    return { ok: false, reason: "protocol-unconfirmed" };
  }
  return { ok: false, reason: "protocol-unconfirmed" };
}

export function resolveEmployee(
  employeeId: string,
  users: Map<string, LocalUser>,
): LocalUser | SsoFailure {
  const user = users.get(employeeId);
  if (!user || !user.active) {
    return { ok: false, reason: "unknown-user" };
  }
  return user;
}

export function createSession(
  user: LocalUser,
  sessions: Map<string, SessionRecord>,
  nowSeconds = Math.floor(Date.now() / 1000),
  secure = process.env.NODE_ENV === "production",
): { session: SessionRecord; cookie: SessionCookie } {
  const session: SessionRecord = {
    id: randomBytes(32).toString("hex"),
    employeeId: user.employeeId,
    expiresAt: nowSeconds + 60 * 60 * 8,
  };
  sessions.set(session.id, session);
  return {
    session,
    cookie: {
      name: "it_pm_session",
      value: session.id,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    },
  };
}

export function authenticateSso(
  body: unknown,
  dependencies: SsoDependencies = {},
): SsoFailure | { ok: true; cookie: SessionCookie } {
  const config = dependencies.config ?? readSsoConfig();
  const parsed = parseSsoRequest(body);
  if ("ok" in parsed) return parsed;
  if (!config.protocolConfirmed || !config.enabled) {
    return { ok: false, reason: "protocol-unconfirmed" };
  }
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  const fresh = validateTimestamp(parsed.timestamp, config.maxAgeSeconds, now());
  if (!fresh.ok) return fresh;
  const signature = verifySignature(config, parsed);
  if (!signature.ok) return signature;
  const user = resolveEmployee(parsed.employeeId, dependencies.users ?? new Map());
  if ("ok" in user) return user;
  const nonce = claimNonce(parsed.nonce, dependencies.consumedNonces ?? new Set());
  if (!nonce.ok) return nonce;
  const { cookie } = createSession(
    user,
    dependencies.sessions ?? new Map(),
    now(),
  );
  return { ok: true, cookie };
}

export function testCanonicalMessage(request: Omit<ParsedSsoRequest, "signature">) {
  return [
    request.issuer,
    request.audience,
    request.employeeId,
    request.nonce,
    String(request.timestamp),
  ].join("\n");
}

export function signTestRequest(
  request: Omit<ParsedSsoRequest, "signature">,
  secret: string,
) {
  return createHmac("sha256", secret)
    .update(testCanonicalMessage(request))
    .digest("hex");
}

export function verifyTestSignature(
  request: ParsedSsoRequest,
  secret: string,
): SsoFailure | { ok: true } {
  if (process.env.NODE_ENV === "production") {
    throw new Error("HRIS SSO test mode cannot run in production");
  }
  const expected = signTestRequest(request, secret);
  const actual = Buffer.from(request.signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    actual.length !== expectedBuffer.length ||
    !timingSafeEqual(actual, expectedBuffer)
  ) {
    return { ok: false, reason: "invalid-signature" };
  }
  return { ok: true };
}

export function authenticateTestSso(
  body: unknown,
  dependencies: SsoDependencies & { secret: string; issuer: string; audience: string },
): SsoFailure | { ok: true; cookie: SessionCookie } {
  if (process.env.NODE_ENV === "production" || !dependencies.config?.testMode) {
    throw new Error("HRIS SSO test mode cannot run in production");
  }
  const parsed = parseSsoRequest(body);
  if ("ok" in parsed) return parsed;
  if (parsed.issuer !== dependencies.issuer) {
    return { ok: false, reason: "invalid-issuer" };
  }
  if (parsed.audience !== dependencies.audience) {
    return { ok: false, reason: "invalid-audience" };
  }
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  const fresh = validateTimestamp(
    parsed.timestamp,
    dependencies.config.maxAgeSeconds,
    now(),
  );
  if (!fresh.ok) return fresh;
  const signature = verifyTestSignature(parsed, dependencies.secret);
  if (!signature.ok) return signature;
  const user = resolveEmployee(parsed.employeeId, dependencies.users ?? new Map());
  if ("ok" in user) return user;
  const nonce = claimNonce(parsed.nonce, dependencies.consumedNonces ?? new Set());
  if (!nonce.ok) return nonce;
  const { cookie } = createSession(user, dependencies.sessions ?? new Map(), now());
  return { ok: true, cookie };
}
