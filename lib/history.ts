export type HistoryEntry = {
  id: string;
  message: string;
  time: string;
  at: string;
  actor: string;
  action: string;
  project: string;
  employee: string;
  detail: string;
};

const storageKey = "it_pm_history";

export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value) => {
      const entry = normalizeHistoryEntry(value);
      return entry ? [entry] : [];
    });
  } catch {
    return [];
  }
}

export function recordHistory(
  input: Omit<HistoryEntry, "id" | "time" | "at">,
): HistoryEntry {
  const entry: HistoryEntry = {
    ...input,
    id: crypto.randomUUID(),
    time: new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    at: new Date().toISOString(),
  };
  const next = [entry, ...readHistory()].slice(0, 200);
  localStorage.setItem(storageKey, JSON.stringify(next));
  return entry;
}

function normalizeHistoryEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<HistoryEntry>;
  if (typeof entry.id !== "string" || typeof entry.message !== "string") return null;
  if (typeof entry.time !== "string" || typeof entry.at !== "string") return null;
  return {
    id: entry.id,
    message: entry.message,
    time: entry.time,
    at: entry.at,
    actor: typeof entry.actor === "string" ? entry.actor : "",
    action: typeof entry.action === "string" ? entry.action : "Activity",
    project: typeof entry.project === "string" ? entry.project : "",
    employee: typeof entry.employee === "string" ? entry.employee : "",
    detail: typeof entry.detail === "string" ? entry.detail : entry.message,
  };
}
