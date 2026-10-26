import assert from "node:assert/strict";
import test from "node:test";
import { buildManagedUsers, type PersonRow } from "../lib/managed-users.ts";

const env = { IT_PM_BOOTSTRAP_SUPER_ADMINS: "WS168", IT_PM_BOOTSTRAP_ADMINS: "WS-001" };
const person = (id: string, extra: Partial<PersonRow> = {}): PersonRow => ({
  employee_number: id, name: id, email: "", dept_code: "", dept_name: "", position: "", role_name: "employee", role_label: "Employee", active: 1, ...extra,
});

test("HRMS endpoint rows (strings, boolean enabled) map the same as direct MySQL rows", () => {
  const people = [person("WS168", { role_name: "dept_head", dept_name: "IT" }), person("WS-001", { role_name: "president" }), person("WI03"), person("WI172", { dept_name: "IT" })];
  const viaHris = buildManagedUsers(people, [
    { employee_number: "WI03", role: "viewer", enabled: true, updated_by: "BEN", updated_at: "2026-10-26 13:34:10" },
    { employee_number: "WI172", role: "it_staff", enabled: false, updated_by: "ARLEY", updated_at: "2026-10-26 13:29:42" },
  ], env);
  const viaDb = buildManagedUsers(people, [
    { employee_number: "WI03", role: "viewer", enabled: 1, updated_by: "BEN", updated_at: new Date("2026-10-26T13:34:10") },
    { employee_number: "WI172", role: "it_staff", enabled: 0, updated_by: "ARLEY", updated_at: new Date("2026-10-26T13:29:42") },
  ], env);
  assert.deepEqual(viaHris, viaDb);
  const by = Object.fromEntries(viaHris.map((u) => [u.employeeNumber, u]));
  assert.equal(by.WS168.access, "super_admin");
  assert.equal(by["WS-001"].access, "admin");
  assert.equal(by.WI03.access, "viewer");
  assert.equal(by.WI172.access, "none");
  assert.equal(by.WI172.assignedRole, "it_staff");
});