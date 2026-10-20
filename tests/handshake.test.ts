import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConsumeBody,
  claimsFromPayload,
  consumeHrisToken,
  issueSessionCookie,
  readHandshakeConfig,
  readSessionProfile,
  readSessionSecret,
  readSignedJson,
  safeNextPath,
  signTimestampBody,
  type EmployeeClaims,
} from "../lib/sso/handshake.ts";
import { canEditProject, resolveAccess } from "../lib/sso/access.ts";

const secret = "local-project-management-test-secret-32";
const sessionSecret = "separate-cookie-signing-secret-for-tests-0001";
const now = 1_700_000_000;

function hrmsUser(extra: Record<string, unknown> = {}) {
  return {
    hrms_user_id: 4,
    employee_number: "E-100",
    email: "a@example.com",
    display_name: "A User",
    hrms_role: "employee",
    position_title: "IT Officer",
    department_code: "IT",
    department_name: "IT Department",
    is_active: true,
    ...extra,
  };
}

function fakeHrms(user: Record<string, unknown>, opts: { badSig?: boolean; status?: number } = {}) {
  return async (_url: unknown, init?: RequestInit) => {
    const sent = JSON.parse(String(init?.body)) as { nonce: string };
    const responseRaw = JSON.stringify({ success: true, audience: "project_management", nonce: sent.nonce, user });
    const timestamp = String(now);
    const sig = signTimestampBody(opts.badSig ? "wrong-secret-wrong-secret-wrong-123" : secret, timestamp, responseRaw);
    return new Response(responseRaw, {
      status: opts.status ?? 200,
      headers: { "x-sso-timestamp": timestamp, "x-sso-signature": sig },
    });
  };
}

const cfg = { consumeUrl: "http://localhost/hrms/consume", secret, allowedPaths: ["/"] };

test("signed consume response yields claims incl. department", async () => {
  const result = await consumeHrisToken("ab".repeat(32), cfg, fakeHrms(hrmsUser()) as typeof fetch, now);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.claims.departmentCode, "IT");
    assert.equal(result.claims.position, "IT Officer");
  }
});

test("bad response signature is rejected", async () => {
  const result = await consumeHrisToken("ab".repeat(32), cfg, fakeHrms(hrmsUser(), { badSig: true }) as typeof fetch, now);
  assert.deepEqual(result, { ok: false, reason: "invalid-signature" });
});

test("malformed token never calls HRMS", async () => {
  let called = false;
  const result = await consumeHrisToken("nope", cfg, (async () => { called = true; return new Response(); }) as typeof fetch, now);
  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test("nonce mismatch and inactive users are rejected", () => {
  assert.equal(claimsFromPayload({ success: true, audience: "project_management", nonce: "x", user: hrmsUser() }, "y"), null);
  assert.equal(claimsFromPayload({ success: true, audience: "project_management", nonce: "x", user: hrmsUser({ is_active: false }) }, "x"), null);
});

test("resolveAccess maps roles and president; everyone else is it_staff", () => {
  const base = { accountType: "employee", position: "", departmentCode: "", departmentName: "" };
  const env = {};
  assert.equal(resolveAccess({ ...base, accountType: "super_admin" }, env), "super_admin");
  assert.equal(resolveAccess({ ...base, position: "President" }, env), "president");
  assert.equal(resolveAccess({ ...base, accountType: "president" }, env), "president");
  assert.equal(resolveAccess({ ...base, departmentCode: "IT" }, env), "it_staff");
  assert.equal(resolveAccess({ ...base, departmentName: "Information Technology" }, env), "it_staff");
  assert.equal(resolveAccess({ ...base, accountType: "hr_admin", departmentCode: "HR" }, env), "it_staff");
  assert.equal(resolveAccess({ ...base }, env), "it_staff");
});

test("canEditProject: managers edit all, IT staff only own/assigned", () => {
  const p = { owner: "Arley Flores", assignees: ["Ben Ryan"] };
  assert.equal(canEditProject({ name: "Someone", access: "president" }, p), true);
  assert.equal(canEditProject({ name: "Someone", access: "super_admin" }, p), true);
  assert.equal(canEditProject({ name: "arley flores", access: "it_staff" }, p), true);
  assert.equal(canEditProject({ name: "Ben Ryan", access: "it_staff" }, p), true);
  assert.equal(canEditProject({ name: "Other", access: "it_staff" }, p), false);
});

test("session cookie verifies, expires, and rejects tampering/other secret", () => {
  const claims: EmployeeClaims = {
    employeeNumber: "E-100", displayName: "A User", email: "", hrmsUserId: 4,
    accountType: "employee", position: "IT Officer", departmentCode: "IT", departmentName: "IT Department",
  };
  const cookie = issueSessionCookie(sessionSecret, claims, "it_staff", now, false, 7200);
  assert.equal(cookie.maxAge, 7200);
  const profile = readSessionProfile(cookie.value, sessionSecret, now + 10);
  assert.equal(profile?.access, "it_staff");
  assert.equal(readSessionProfile(cookie.value, sessionSecret, now + 7200), null);
  assert.equal(readSessionProfile(cookie.value, secret, now + 10), null);
  const [payload, sig] = cookie.value.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), access: "super_admin" })).toString("base64url");
  assert.equal(readSessionProfile(`${forged}.${sig}`, sessionSecret, now + 10), null);
});

test("config honours HRIS_SSO_ENABLED and separate session secret", () => {
  const env = { HRIS_SSO_SECRET: secret, HRIS_SSO_CONSUME_URL: "http://localhost/x" };
  assert.equal(readHandshakeConfig({ ...env, HRIS_SSO_ENABLED: "false" }), null);
  assert.notEqual(readHandshakeConfig({ ...env, HRIS_SSO_ENABLED: "true" }), null);
  assert.equal(readSessionSecret({ IT_PM_SESSION_SECRET: secret, HRIS_SSO_SECRET: secret }), "");
  assert.equal(readSessionSecret({ IT_PM_SESSION_SECRET: sessionSecret, HRIS_SSO_SECRET: secret }), sessionSecret);
});

test("safeNextPath and signing helpers", () => {
  assert.equal(safeNextPath("//evil.example", ["/"]), "/");
  assert.equal(safeNextPath("/history", ["/", "/history"]), "/history");
  const raw = buildConsumeBody("AB".repeat(32), "n1");
  assert.match(raw, /"token":"abab/);
  const sig = signTimestampBody(secret, String(now), raw);
  assert.equal(readSignedJson(secret, raw, String(now), sig, now).ok, true);
  assert.equal(readSignedJson(secret, raw, String(now), sig, now + 120).ok, false);
});
