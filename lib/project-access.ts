import { VIEW_ONLY_ERROR, canEditProject, isViewOnly, type AccessLevel } from "./sso/access.ts";

export type Viewer = { name: string; access: AccessLevel };
export type OwnedProject = { name: string; assignees: string[] };

export type AccessDecision = { ok: true } | { ok: false; status: 403; error: string };

const deny = (error: string): AccessDecision => ({ ok: false, status: 403, error });

function same(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Server-side ownership rules.
 * - super_admin / admin / president: full CRUD on every project.
 * - it_staff: may create a project only as its owner, and may update / archive /
 *   restore only projects they own or are assigned to (checked against the STORED row,
 *   never the incoming payload).
 */
export function authorizeProjectSave(
  viewer: Viewer,
  existing: OwnedProject | null,
  incoming: OwnedProject,
): AccessDecision {
  if (isViewOnly(viewer.access)) return deny(VIEW_ONLY_ERROR);
  if (existing) {
    return canEditProject(viewer, { owner: existing.name, assignees: existing.assignees })
      ? { ok: true }
      : deny("You can only edit projects you own or are assigned to.");
  }
  if (viewer.access === "super_admin" || viewer.access === "admin" || viewer.access === "president") return { ok: true };
  return same(incoming.name, viewer.name) && viewer.name.trim() !== ""
    ? { ok: true }
    : deny("New projects must be owned by you.");
}

export function authorizeProjectChange(viewer: Viewer, existing: OwnedProject | null): AccessDecision {
  if (isViewOnly(viewer.access)) return deny(VIEW_ONLY_ERROR);
  if (!existing) return { ok: false, status: 403, error: "Project not found." };
  return canEditProject(viewer, { owner: existing.name, assignees: existing.assignees })
    ? { ok: true }
    : deny("You can only archive or reopen projects you own or are assigned to.");
}
