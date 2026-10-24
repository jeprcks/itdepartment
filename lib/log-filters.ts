export type LogLike = { at: string; actor: string; employee: string; project: string; action: string };
export type LogFilters = { project?: string; person?: string; action?: string; from?: string; to?: string };

/** from/to are YYYY-MM-DD (inclusive), compared in the viewer's local day when run in the browser. */
export function filterLogs<T extends LogLike>(logs: T[], filters: LogFilters): T[] {
  const project = filters.project?.trim().toLowerCase() ?? "";
  const person = filters.person?.trim().toLowerCase() ?? "";
  const action = filters.action?.trim() ?? "";
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : null;
  return logs.filter((log) => {
    if (project && log.project.trim().toLowerCase() !== project) return false;
    if (person && !log.actor.toLowerCase().includes(person) && !log.employee.toLowerCase().includes(person)) return false;
    if (action && log.action !== action) return false;
    const at = new Date(log.at).getTime();
    if (from !== null && !(at >= from)) return false;
    if (to !== null && !(at <= to)) return false;
    return true;
  });
}
