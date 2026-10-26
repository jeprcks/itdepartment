"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import Modal from "@/components/modal";
import PageHeader from "@/components/page-header";
import { Pagination, SortHeader, compareValues, nextSort, type SortState } from "@/components/table-controls";
import { filterLogs, type LogFilters } from "@/lib/log-filters.ts";
import type { HistoryEntry } from "@/lib/history.ts";
import { APP_ROLES, ROLE_LABELS, isAppRole } from "@/lib/access-rules.ts";

function roleLabel(role?: string) {
  return isAppRole(role) ? ROLE_LABELS[role] : "";
}

function describeLog(entry: HistoryEntry) {
  const who = entry.actor ? `${entry.actor}${roleLabel(entry.actorRole) ? ` (${roleLabel(entry.actorRole)})` : ""}` : "Someone";
  const person = entry.employee;
  if ((entry.action === "Role changed" || entry.action === "Access enabled" || entry.action === "Access disabled") && person) {
    return `${who} changed IT Department access for ${person}: ${entry.detail || entry.action}.`;
  }
  if (entry.action === "Assigned" && person) {
    return `${who} assigned ${person} as IT staff on this project.`;
  }
  if (entry.action === "Removed" && person) {
    return `${who} removed ${person} from the IT staff on this project.`;
  }
  if (entry.action === "Archived") {
    return `${who} moved this project to the archive.`;
  }
  if (entry.action === "Restored") {
    return `${who} reopened this project from the archive.`;
  }
  if (entry.action === "Deleted") {
    return `${who} deleted this project.`;
  }
  if (entry.action === "Added") {
    const status = entry.detail ? ` Starting point: ${entry.detail}.` : "";
    return `${who} added this project. The signed-in account is the owner.${status}`;
  }
  if (entry.action === "Note added") {
    return `${who} added a note: ${entry.detail || "—"}.`;
  }
  if (entry.action === "Note updated") {
    return `${who} updated the note: ${entry.detail || "—"}.`;
  }
  if (entry.action === "Status changed") {
    return `${who} changed the status${entry.detail ? ` (${entry.detail})` : ""}.`;
  }
  if (entry.action === "Updated") {
    return `${who} updated the project details${entry.detail ? ` (${entry.detail})` : ""}.`;
  }
  return entry.message;
}

function noteText(entry: HistoryEntry) {
  if (entry.action === "Note added" || entry.action === "Note updated") {
    return entry.detail === "Note removed" ? "" : entry.detail;
  }
  const match = entry.detail.match(/Note:\s*([\s\S]+)$/);
  return match?.[1]?.trim() ?? "";
}

type LogSortKey = "at" | "actor" | "project" | "action";

const emptyFilters: Required<LogFilters> = { project: "", person: "", action: "", role: "", from: "", to: "" };

export default function HistoryPage({ readOnly = false }: { readOnly?: boolean }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState<SortState<LogSortKey>>({ key: "at", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const projectOptions = useMemo(
    () => [...new Set(entries.map((entry) => entry.project).filter(Boolean))].sort(compareValues),
    [entries],
  );
  const actionOptions = useMemo(
    () => [...new Set(entries.map((entry) => entry.action).filter(Boolean))].sort(compareValues),
    [entries],
  );
  const filtered = filterLogs(entries, filters);
  const sorted = [...filtered].sort((a, b) => {
    const result = sort.key === "at" ? compareValues(Date.parse(a.at) || 0, Date.parse(b.at) || 0) : compareValues(a[sort.key], b[sort.key]);
    return sort.dir === "asc" ? result : -result;
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilters = Object.values(filters).some(Boolean);
  const exportHref = `/api/export/logs?${new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString()}`;
  const setFilter = (key: keyof LogFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const onSort = (key: LogSortKey) => {
    setSort((current) => nextSort(current, key));
    setPage(1);
  };
  const field =
    "h-9 rounded-lg border border-[#d7e0ea] bg-[#f8fafc] px-2.5 text-xs text-[#193956] outline-none transition focus:border-[#1d4e89] focus:bg-white focus:ring-2 focus:ring-[#1d4e89]/15";

  useEffect(() => {
    let active = true;
    fetch("/api/logs")
      .then((response) => (response.ok ? response.json() : { logs: [] }))
      .then((body: { logs?: HistoryEntry[] }) => {
        if (active) setEntries(body.logs ?? []);
      })
      .catch(() => {
        if (active) setEntries([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#f4f7fb] px-5 py-5 font-sans sm:px-7 sm:py-6">
      <PageHeader
        title="Activity logs"
        description="A complete record of who changed which project, and what changed. Click a row for details."
      />
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#d7e0ea] bg-white shadow-sm">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#e6edf3] px-5 py-4">
          <div className="mr-auto">
            <h2 className="text-sm font-bold tracking-tight text-[#193956]">Recent activity</h2>
            <p className="mt-0.5 text-xs text-[#5c6b7a]">
              Showing {filtered.length} of {entries.length} entries
            </p>
          </div>
          {readOnly ? <span className="inline-flex items-center gap-1 rounded-full border border-[#d7e0ea] bg-[#eef3f8] px-2.5 py-1 text-xs font-semibold text-[#385875]"><i className="bi bi-eye" aria-hidden="true" />View only</span> : null}
          <a
            hidden={readOnly}
            href={exportHref}
            download
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#d7e0ea] bg-white px-3 text-xs font-semibold text-[#385875] transition hover:border-[#385875] hover:bg-[#eef3f8]"
          >
            <i className="bi bi-download" aria-hidden="true" />
            Export CSV
          </a>
        </header>
        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-[#e6edf3] bg-[#fbfcfe] px-5 py-3" role="search" aria-label="Filter logs">
          <label className="grid gap-1 text-[11px] font-medium text-[#5c6b7a]">
            Project
            <select value={filters.project} onChange={(event) => setFilter("project", event.target.value)} className={`${field} min-w-40`}>
              <option value="">All projects</option>
              {projectOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-[#5c6b7a]">
            Person
            <input
              value={filters.person}
              onChange={(event) => setFilter("person", event.target.value)}
              placeholder="Changed by or employee"
              className={`${field} w-48`}
            />
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-[#5c6b7a]">
            Role
            <select value={filters.role} onChange={(event) => setFilter("role", event.target.value)} className={`${field} min-w-32`}>
              <option value="">All roles</option>
              {APP_ROLES.filter((value) => value !== "none").map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-[#5c6b7a]">
            Action
            <select value={filters.action} onChange={(event) => setFilter("action", event.target.value)} className={`${field} min-w-36`}>
              <option value="">All actions</option>
              {actionOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-[#5c6b7a]">
            From
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilter("from", event.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-[#5c6b7a]">
            To
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilter("to", event.target.value)} className={field} />
          </label>
          {activeFilters ? (
            <button
              type="button"
              onClick={() => {
                setFilters(emptyFilters);
                setPage(1);
              }}
              className="h-9 rounded-lg px-3 text-xs font-semibold text-[#9b2c2c] transition hover:bg-[#fdecec]"
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#e6edf3] bg-[#f8fafc] text-[#5c6b7a]">
              <tr>
                <SortHeader label="Time" sortKey="at" sort={sort} onSort={onSort} />
                <SortHeader label="Changed by" sortKey="actor" sort={sort} onSort={onSort} />
                <SortHeader label="Project" sortKey="project" sort={sort} onSort={onSort} />
                <th scope="col" className="px-5 py-3 font-medium">
                  What happened
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-20 text-center text-sm text-[#5c6b7a]">
                    {entries.length === 0 ? "No activity yet. Changes to projects will be recorded here." : "No entries match these filters."}
                  </td>
                </tr>
              ) : (
                paged.map((entry) => (
                  <tr
                    key={entry.id}
                    tabIndex={0}
                    aria-label={`View log details: ${entry.action} on ${entry.project || "project"}`}
                    className="cursor-pointer border-t border-[#eef2f6] text-[#193956] outline-none transition-colors hover:bg-[#f5f9fd] focus-visible:bg-[#f1f6fb] focus-visible:ring-2 focus-visible:ring-[#1d4e89]/40 focus-visible:ring-inset"
                    onClick={() => setSelected(entry)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(entry);
                      }
                    }}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap text-[#5c6b7a]">
                      <time dateTime={entry.at}>{entry.time}</time>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {entry.actor || "—"}
                      {roleLabel(entry.actorRole) ? <span className="block text-xs text-[#5c6b7a]">{roleLabel(entry.actorRole)}</span> : null}
                    </td>
                    <td className="px-5 py-3.5">{entry.project || "—"}</td>
                    <td className="px-5 py-3.5">{describeLog(entry)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sorted.length > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={sorted.length}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </section>
      <AnimatePresence>
      {selected ? (
        <Modal
          labelledBy="log-detail-title"
          onClose={() => setSelected(null)}
          className="w-full max-w-lg rounded-2xl border border-[#d7e0ea] bg-white shadow-2xl"
        >
            <header className="flex items-start justify-between gap-4 border-b border-[#e6edf3] px-5 py-4">
              <div>
                <p className="text-xs font-medium tracking-wide text-[#5c6b7a] uppercase">
                  {selected.project || "Log"}
                </p>
                <h2 id="log-detail-title" className="mt-1 text-lg font-semibold text-[#193956]">
                  {selected.action}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md px-2 py-1 text-sm text-[#5c6b7a] hover:bg-[#f5f7fa] hover:text-[#193956]"
              >
                Close
              </button>
            </header>
            <div className="flex flex-col gap-4 px-5 py-5 text-sm text-[#193956]">
              <p>{describeLog(selected)}</p>
              <p className="text-xs text-[#5c6b7a]">
                <time dateTime={selected.at}>{selected.time}</time>
                {selected.actor ? ` · Changed by ${selected.actor}${roleLabel(selected.actorRole) ? ` (${roleLabel(selected.actorRole)})` : ""}` : ""}
              </p>
              {noteText(selected) ? (
                <div>
                  <p className="text-xs font-medium text-[#5c6b7a]">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap">{noteText(selected)}</p>
                </div>
              ) : null}
            </div>
        </Modal>
      ) : null}
      </AnimatePresence>
    </div>
  );
}
