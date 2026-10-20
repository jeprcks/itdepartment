export type AccessLevel = "super_admin" | "president" | "it_staff";

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
 * Maps HRMS identity to an itdepartment access level, or null (denied).
 * - HRMS role super_admin            -> super_admin (everything)
 * - HRMS role president, or position title in PRESIDENT list -> president (CRUD on all)
 * - department code/name in IT list  -> it_staff (CRUD on own projects only)
 */
export function resolveAccess(input: AccessInput, env: Env = process.env): AccessLevel | null {
  const role = input.accountType.trim().toLowerCase();
  if (role === "super_admin") return "super_admin";
  if (role === "president") return "president";

  const position = input.position.trim().toLowerCase();
  if (position !== "" && list(env.IT_PM_PRESIDENT_POSITIONS, "President").includes(position)) {
    return "president";
  }

  const codes = list(env.IT_PM_IT_DEPARTMENT_CODES, "IT");
  const names = list(env.IT_PM_IT_DEPARTMENT_NAMES, "IT Department,Information Technology");
  const code = input.departmentCode.trim().toLowerCase();
  const name = input.departmentName.trim().toLowerCase();
  if ((code !== "" && codes.includes(code)) || (name !== "" && names.includes(name))) {
    return "it_staff";
  }
  return null;
}

export type ProjectOwnership = {
  owner: string;
  assignees: string[];
};

export function canManageAll(access: AccessLevel) {
  return access === "super_admin" || access === "president";
}

/** it_staff may only change projects they own or are assigned to. */
export function canEditProject(
  viewer: { name: string; access: AccessLevel },
  project: ProjectOwnership,
) {
  if (canManageAll(viewer.access)) return true;
  const me = viewer.name.trim().toLowerCase();
  if (me === "") return false;
  return (
    project.owner.trim().toLowerCase() === me ||
    project.assignees.some((name) => name.trim().toLowerCase() === me)
  );
}
