import assert from "node:assert/strict";
import test from "node:test";
import { authorizeProjectChange, authorizeProjectSave } from "../lib/project-access.ts";
import { toCsv } from "../lib/csv.ts";
import { filterLogs, logsForProject } from "../lib/log-filters.ts";

const admin = { name: "Root Admin", access: "super_admin" as const };
const president = { name: "The President", access: "president" as const };
const staff = { name: "Ana Cruz", access: "it_staff" as const };
const owned = { name: "Ana Cruz", assignees: [] };
const assigned = { name: "Ben Reyes", assignees: ["  ana cruz "] };
const other = { name: "Ben Reyes", assignees: ["Carl Uy"] };

test("managers have full CRUD on any project", () => {
  for (const viewer of [admin, president]) {
    assert.equal(authorizeProjectSave(viewer, other, other).ok, true);
    assert.equal(authorizeProjectSave(viewer, null, other).ok, true);
    assert.equal(authorizeProjectChange(viewer, other).ok, true);
  }
});

test("it_staff can edit/archive only owned or assigned projects (stored row wins)", () => {
  assert.equal(authorizeProjectSave(staff, owned, owned).ok, true);
  assert.equal(authorizeProjectSave(staff, assigned, assigned).ok, true);
  assert.equal(authorizeProjectChange(staff, assigned).ok, true);
  const denied = authorizeProjectSave(staff, other, { name: "Ana Cruz", assignees: ["Ana Cruz"] });
  assert.equal(denied.ok, false);
  assert.equal(!denied.ok && denied.status, 403);
  assert.equal(authorizeProjectChange(staff, other).ok, false);
});

test("it_staff can create only projects they own", () => {
  assert.equal(authorizeProjectSave(staff, null, { name: "ana cruz", assignees: [] }).ok, true);
  assert.equal(authorizeProjectSave(staff, null, { name: "Ben Reyes", assignees: ["Ana Cruz"] }).ok, false);
  assert.equal(authorizeProjectSave({ name: " ", access: "it_staff" }, null, { name: " ", assignees: [] }).ok, false);
});

test("archive/restore of a missing project is denied", () => {
  assert.equal(authorizeProjectChange(admin, null).ok, false);
});

test("csv has BOM, escapes quotes and guards formulas", () => {
  const csv = toCsv(["A", "B"], [['He said "hi"', "=SUM(1)"]]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"He said ""hi"""'));
  assert.ok(csv.includes(`"'=SUM(1)"`));
});

test("log filters: project, person, action, date range", () => {
  const logs = [
    { at: "2026-10-01T10:00:00", actor: "Ana", employee: "", project: "Alpha", action: "Added" },
    { at: "2026-10-05T10:00:00", actor: "Ben", employee: "Ana", project: "Beta", action: "Assigned" },
    { at: "2026-10-09T10:00:00", actor: "Carl", employee: "", project: "alpha", action: "Updated" },
  ];
  assert.equal(filterLogs(logs, { project: "Alpha" }).length, 2);
  assert.equal(filterLogs(logs, { person: "ana" }).length, 2);
  assert.equal(filterLogs(logs, { action: "Assigned" }).length, 1);
  assert.equal(filterLogs(logs, { from: "2026-10-02", to: "2026-10-09" }).length, 2);
  assert.equal(filterLogs(logs, { to: "2026-10-01" }).length, 1);
});

test("project activity: match by ID, fall back to name only for rows without ID", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const logs = [
    { project: "Old Name", projectId: id },
    { project: "New Name", projectId: id },
    { project: "New Name", projectId: "" },
    { project: "new name", projectId: "22222222-2222-2222-2222-222222222222" },
    { project: "Other", projectId: "" },
  ];
  assert.equal(logsForProject(logs, id, "New Name").length, 3);
  assert.equal(logsForProject(logs, "", "New Name").length, 3);
  assert.equal(logsForProject(logs, "", "").length, 5);
});
