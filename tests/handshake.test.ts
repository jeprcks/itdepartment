import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConsumeBody,
  claimsFromPayload,
  consumeHrisToken,
  readSignedJson,
  safeNextPath,
  signTimestampBody,
} from "../lib/sso/handshake.ts";

const secret = "local-project-management-test-secret-32";
const now = 1_700_000_000;

test("signed consume response yields employee claims", async () => {
  const token = "ab".repeat(32);
  const result = await consumeHrisToken(token, {
    consumeUrl: "https://hris.example/api/sso/project-management/consume",
    secret,
    allowedPaths: ["/"],
  }, async (_url, init) => {
    const request = init as RequestInit;
    const raw = String(request.body);
    const sent = JSON.parse(raw) as { nonce: string };
    const responseRaw = JSON.stringify({
      success: true,
      audience: "project_management",
      nonce: sent.nonce,
      user: {
        hrms_user_id: 4,
        employee_number: "E-100",
        email: "a@example.com",
        display_name: "A User",
        hrms_role: "staff",
        is_active: true,
      },
    });
    const timestamp = String(now);
    return new Response(responseRaw, {
      status: 200,
      headers: {
        "x-sso-timestamp": timestamp,
        "x-sso-signature": signTimestampBody(secret, timestamp, responseRaw),
      },
    });
  }, now);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.claims.employeeNumber, "E-100");
    assert.equal(result.cookie.httpOnly, true);
    assert.equal(result.cookie.sameSite, "lax");
  }
});

test("invalid response signatures are rejected", () => {
  const raw = JSON.stringify({ success: true });
  const result = readSignedJson(secret, raw, String(now), "aa".repeat(32), now);
  assert.equal(result.ok, false);
});

test("expired response timestamps are rejected", () => {
  const raw = "{}";
  const timestamp = String(now - 500);
  const result = readSignedJson(
    secret,
    raw,
    timestamp,
    signTimestampBody(secret, timestamp, raw),
    now,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "expired");
});

test("a mismatched nonce does not create claims", () => {
  const raw = buildConsumeBody("ab".repeat(32), "abc");
  const signed = readSignedJson(secret, raw, String(now), signTimestampBody(secret, String(now), raw), now);
  assert.equal(signed.ok, true);
  if (signed.ok) assert.equal(claimsFromPayload(signed.payload, "def"), null);
});

test("open redirects fall back to the dashboard", () => {
  assert.equal(safeNextPath("https://evil.example", ["/"]), "/");
  assert.equal(safeNextPath("//evil.example", ["/"]), "/");
  assert.equal(safeNextPath("/", ["/"]), "/");
});
