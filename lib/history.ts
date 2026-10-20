export type HistoryEntry = {
  id: string;
  message: string;
  time: string;
  at: string;
};

const storageKey = "it_pm_history";

export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry);
  } catch {
    return [];
  }
}

export function recordHistory(message: string): HistoryEntry {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    message,
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

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<HistoryEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.message === "string" &&
    typeof entry.time === "string" &&
    typeof entry.at === "string"
  );
}
