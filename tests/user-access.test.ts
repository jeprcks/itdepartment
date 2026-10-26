import assert from "node:assert/strict";
import test from "node:test";
import {
  assignableRoles,
  authorizeAccessChange,
  canManageUsers,
  effectiveAccess,
  hrmsDefaultAccess,
} from "../lib/access-rules.ts";

const env = { IT_PM_BOOTSTRAP_SUPER_ADMINS: "WS168", IT_PM_BOOTSTRAP_ADMINS: "WS-001" };
const base = { accountType: "employee", position: "", departmentCode: "", departmentName: "" };
const arley = { sub: "WS168", access: "super_admin" };
const ben = { sub: "WS-001", access: "admin" };
const staff = { employeeNumber: "WI03", role: "it_staff" as const, enabled: true };

test("HRIS default mirrors HRMS eligibility, never grants super admin", () => {
  assert.equal(hrmsDefaultAccess({ ...base, accountType: "super_admin" }, env), "president");
  assert.equal(hrmsDefaultAccess({ ...base, accountType: "president" }, env), "president");
  assert.equal(hrmsDefaultAccess({ ...base, departmentCode: "IT" }, env), "it_staff");
  assert.equal(hrmsDefaultAccess({ ...base, departmentName: "Marketing" }, env), "none");
});

test("Arley is protected Super Admin even if HRMS says dept_head; Ben is Admin", () => {
  assert.deepEqual(effectiveAccess("WS168", "it_staff", { role: "none", enabled: false }, env), { access: "super_admin", source: "bootstrap", enabled: true });
  assert.deepEqual(effectiveAccess("WS-001", "president", null, env), { access: "admin", source: "bootstrap", enabled: true });
  assert.equal(effectiveAccess("WI03", "it_staff", { role: "super_admin", enabled: true }, env).access, "president");
  assert.equal(effectiveAccess("WI03", "it_staff", { role: "admin", enabled: true }, env).access, "president");
  assert.equal(effectiveAccess("WI03", "it_staff", { role: "president", enabled: false }, env).access, "none");
});

test("only Super Admin and Admin can manage users", () => {
  assert.equal(canManageUsers("super_admin"), true);
  assert.equal(canManageUsers("admin"), true);
  for (const access of ["president", "it_staff", "none"]) {
    assert.equal(canManageUsers(access), false);
    assert.equal(authorizeAccessChange({ sub: "X", access }, staff, env).ok, false);
  }
});

test("Arley can edit Ben and others", () => {
  assert.equal(authorizeAccessChange(arley, staff, env).ok, true);
  assert.equal(authorizeAccessChange(arley, { employeeNumber: "WS-001", role: "president", enabled: true }, env).ok, true);
  assert.equal(authorizeAccessChange(arley, { employeeNumber: "WS-001", role: "admin", enabled: false }, env).ok, true);
  assert.deepEqual(assignableRoles("super_admin", "WS-001", env), ["admin", "president", "it_staff", "viewer", "none"]);
});

test("Ben can edit others but not Arley, and cannot assign super admin or admin", () => {
  assert.equal(authorizeAccessChange(ben, staff, env).ok, true);
  const editArley = authorizeAccessChange(ben, { employeeNumber: "WS168", role: "president", enabled: true }, env);
  assert.equal(editArley.ok, false);
  assert.equal(!editArley.ok && editArley.status, 403);
  assert.equal(authorizeAccessChange(ben, { ...staff, role: "super_admin" }, env).ok, false);
  assert.equal(authorizeAccessChange(ben, { ...staff, role: "admin" }, env).ok, false);
  assert.equal(authorizeAccessChange(arley, { ...staff, role: "super_admin" }, env).ok, false);
});

test("nobody changes their own access", () => {
  assert.equal(authorizeAccessChange(ben, { employeeNumber: "ws-001", role: "admin", enabled: false }, env).ok, false);
  assert.equal(authorizeAccessChange(arley, { employeeNumber: "WS168", role: "super_admin", enabled: true }, env).ok, false);
});