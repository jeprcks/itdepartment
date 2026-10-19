import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticateSso,
  authenticateTestSso,
  signTestRequest,
} from "../lib/sso/adapter.ts";
import { readSsoConfig } from "../lib/sso/config.ts";
import type { LocalUser } from "../lib/sso/types.ts";

const secret = "local-test-secret-not-for-hris";
const now = 1_700_000_000;

function config() {
  return readSsoConfig({
    NODE_ENV: "test",
    HRIS_SSO_TEST_MODE: "true",
    HRIS_SSO_ENABLED: "false",
    HRIS_SSO_PROTOCOL: "unconfirmed",
    HRIS_SSO_SECRET: secret,
    HRIS_SSO_ISSUER: "hris-test",
    HRIS_SSO_AUDIENCE: "it-pm-test",
    HRIS_SSO_MAX_AGE_SECONDS: "120",
  });
}

function body(overrides: Record<string, unknown> = {}) {
  const request = {
    issuer: "hris-test",
    audience: "it-pm-test",
    employeeId: "E-100",
    nonce: "nonce-1",
    timestamp: now,
    ...overrides,
  };
  return {
    ...request,
    signature: signTestRequest(request, secret),
  };
}

function users() {
  return new Map<string, LocalUser>([
    ["E-100", { employeeId: "E-100", active: true, role: "member" }],
  ]);
}

test("live adapter rejects a signed request while the protocol is unconfirmed", () => {
  const result = authenticateSso(body(), {
    config: config(),
    now: () => now,
    users: users(),
    consumedNonces: new Set(),
    sessions: new Map(),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "protocol-unconfirmed");
});

test("test harness accepts its own signature and creates a session cookie", () => {
  const result = authenticateTestSso(body(), {
    config: config(),
    secret,
    issuer: "hris-test",
    audience: "it-pm-test",
    now: () => now,
    users: users(),
    consumedNonces: new Set(),
    sessions: new Map(),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.cookie.httpOnly, true);
    assert.equal(result.cookie.sameSite, "lax");
    assert.equal(result.cookie.secure, false);
    assert.equal(result.cookie.value.length, 64);
  }
});

test("test harness rejects an invalid signature", () => {
  const result = authenticateTestSso(
    { ...body(), signature: "ab".repeat(32) },
    harness(),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "invalid-signature");
});

test("malformed signatures are rejected", () => {
  const result = authenticateTestSso({ ...body(), signature: "not-hex" }, harness());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "malformed");
});

test("expired timestamps are rejected", () => {
  const result = authenticateTestSso(body({ timestamp: now - 500, nonce: "n-old" }), harness());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "expired");
});

test("replayed requests are rejected", () => {
  const deps = harness();
  assert.equal(authenticateTestSso(body(), deps).ok, true);
  const again = authenticateTestSso(body(), deps);
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.reason, "replayed");
});

test("unknown users are rejected", () => {
  const result = authenticateTestSso(body({ employeeId: "E-missing", nonce: "n-missing" }), harness());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "unknown-user");
});

test("issuer and audience must match the test configuration", () => {
  const issuer = authenticateTestSso(body({ issuer: "other", nonce: "n-issuer" }), harness());
  const audience = authenticateTestSso(body({ audience: "other", nonce: "n-audience" }), harness());
  assert.equal(issuer.ok, false);
  assert.equal(audience.ok, false);
});

test("test mode cannot be enabled in production", () => {
  assert.throws(() =>
    readSsoConfig({
      NODE_ENV: "production",
      HRIS_SSO_TEST_MODE: "true",
    }),
  );
});

function harness() {
  return {
    config: config(),
    secret,
    issuer: "hris-test",
    audience: "it-pm-test",
    now: () => now,
    users: users(),
    consumedNonces: new Set<string>(),
    sessions: new Map(),
  };
}
