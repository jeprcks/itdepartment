export type AccessLevel = "super_admin" | "admin" | "president" | "it_staff" | "viewer";

export const VIEW_ONLY_ERROR = "View only accounts cannot make changes.";

/** "viewer" (View only): may read projects and logs; every write and every export is refused server-side. */
export function isViewOnly(access: string) {
  return access === "viewer";
}

type Env = Record<string, string | undefined>;

export type AccessInput = {
  accountType: string;
  position: string;
  departmentCode: string;
  departmentName: string;
};

function list(raw: string | undefined, fallback: string) {
  return (raw ?? fallback)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Maps HRMS identity to an itdepartment access level.
 * HRMS decides who may launch (IT dept, President, super_admin), so every
 * authenticated user gets in:
 * - HRMS role super_admin                         -> super_admin (everything)
 * - HRMS role president, or position in PRESIDENT -> president (CRUD on all)
 * - anyone else                                   -> it_staff (own projects only)
 */
export function resolveAccess(input: AccessInput, env: Env = process.env): AccessLevel {
  const role = input.accountType.trim().toLowerCase();
  if (role === "super_admin") return "super_admin";
  if (role === "president") return "president";

  const position = input.position.trim().toLowerCase();
  if (position !== "" && list(env.IT_PM_PRESIDENT_POSITIONS, "President").includes(position)) {
    return "president";
  }
  return "it_staff";
}

export type ProjectOwnership = {
  owner: string;
  assignees: string[];
};

export function canManageAll(access: AccessLevel) {
  return access === "super_admin" || access === "admin" || access === "president";
}

/** President, super admin, and department head notes are announced. */
export function canAnnounceNotes(
  viewer: { access: AccessLevel; position: string },
  env: Env = process.env,
) {
  if (canManageAll(viewer.access)) return true;
  if (isViewOnly(viewer.access)) return false;
  const position = viewer.position.trim().toLowerCase();
  if (position === "") return false;
  return list(env.IT_PM_DEPARTMENT_HEAD_POSITIONS, "department head,dept head,head").includes(
    position,
  );
}

/** it_staff may only change projects they own or are assigned to. */
export function canEditProject(
  viewer: { name: string; access: AccessLevel },
  project: ProjectOwnership,
) {
  if (canManageAll(viewer.access)) return true;
  if (isViewOnly(viewer.access)) return false;
  const me = viewer.name.trim().toLowerCase();
  if (me === "") return false;
  return (
    project.owner.trim().toLowerCase() === me ||
    project.assignees.some((name) => name.trim().toLowerCase() === me)
  );
}
