import assert from "node:assert/strict";
import test from "node:test";
import { assignableRoles, authorizeAccessChange, canManageUsers, effectiveAccess, ROLE_LABELS } from "../lib/access-rules.ts";
import { authorizeProjectChange, authorizeProjectSave } from "../lib/project-access.ts";
import { canAnnounceNotes, canEditProject, canManageAll, isViewOnly } from "../lib/sso/access.ts";

const env = { IT_PM_BOOTSTRAP_SUPER_ADMINS: "WS168", IT_PM_BOOTSTRAP_ADMINS: "WS-001" };
const viewer = { name: "Vee Viewer", access: "viewer" as const };
const own = { name: "Vee Viewer", assignees: ["Vee Viewer"] };

test("View only is labelled and assignable by Super Admin and Admin", () => {
  assert.equal(ROLE_LABELS.viewer, "View only");
  assert.ok(assignableRoles("super_admin", "WI03", env).includes("viewer"));
  assert.ok(assignableRoles("admin", "WI03", env).includes("viewer"));
  const target = { employeeNumber: "WI03", role: "viewer" as const, enabled: true };
  assert.equal(authorizeAccessChange({ sub: "WS168", access: "super_admin" }, target, env).ok, true);
  assert.equal(authorizeAccessChange({ sub: "WS-001", access: "admin" }, target, env).ok, true);
  assert.equal(authorizeAccessChange({ sub: "WS-001", access: "admin" }, { ...target, employeeNumber: "WS168" }, env).ok, false);
});

test("a stored View only decision signs in as viewer", () => {
  assert.equal(effectiveAccess("WI03", "none", { role: "viewer", enabled: true }, env).access, "viewer");
  assert.equal(effectiveAccess("WI03", "none", { role: "viewer", enabled: false }, env).access, "none");
});

test("viewer cannot create, edit, archive or restore any project, even their own", () => {
  assert.equal(isViewOnly("viewer"), true);
  assert.equal(canManageAll("viewer"), false);
  assert.equal(canEditProject(viewer, { owner: own.name, assignees: own.assignees }), false);
  assert.equal(canAnnounceNotes({ access: "viewer", position: "Head" }), false);
  const created = authorizeProjectSave(viewer, null, own);
  assert.equal(created.ok, false);
  assert.equal(!created.ok && created.status, 403);
  assert.equal(authorizeProjectSave(viewer, own, own).ok, false);
  assert.equal(authorizeProjectChange(viewer, own).ok, false);
});

test("viewer cannot use User Management", () => {
  assert.equal(canManageUsers("viewer"), false);
  assert.equal(authorizeAccessChange({ sub: "WI03", access: "viewer" }, { employeeNumber: "WI05", role: "it_staff", enabled: true }, env).ok, false);
});
test("activity log role filter matches the actor's role", async () => {
  const { filterLogs } = await import("../lib/log-filters.ts");
  const logs = [
    { at: "2026-10-26T05:00:00Z", actor: "BEN", actorRole: "admin", employee: "X", project: "", action: "Role changed" },
    { at: "2026-10-26T05:00:00Z", actor: "OLD", employee: "", project: "P", action: "Updated" },
  ];
  assert.equal(filterLogs(logs, { role: "admin" }).length, 1);
  assert.equal(filterLogs(logs, { role: "" }).length, 2);
});
