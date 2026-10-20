"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import Modal from "@/components/modal";
import { readHistory, type HistoryEntry } from "@/lib/history.ts";

function describeLog(entry: HistoryEntry) {
  const who = entry.actor || "Someone";
  const person = entry.employee;
  if (entry.action === "Assigned" && person) {
    return `${who} assigned ${person} as IT staff on this project.`;
  }
  if (entry.action === "Removed" && person) {
    return `${who} removed ${person} from the IT staff on this project.`;
  }
  if (entry.action === "Added") {
    const status = entry.detail ? ` Starting point: ${entry.detail}.` : "";
    return `${who} added this project while signed in.${status}`;
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

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    setEntries(readHistory());
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
      <div className="mb-5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#8aa0b3] uppercase">
          IT Department
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#193956]">Logs</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">
          A record of who changed a project and what they changed.
        </p>
      </div>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#d7e0ea] bg-white shadow-sm">
        <header className="shrink-0 border-b border-[#e6edf3] px-5 py-4">
          <h2 className="text-base font-semibold text-[#193956]">Activity</h2>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#193956] text-[#F5F7FA]">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium whitespace-nowrap">
                  Time
                </th>
                <th scope="col" className="px-5 py-3 font-medium whitespace-nowrap">
                  Changed by
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Project
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  What happened
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-[#5c6b7a]">
                    No logs yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="cursor-pointer border-t border-[#e6edf3] text-[#193956] hover:bg-[#f7fafc]"
                    onClick={() => setSelected(entry)}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap text-[#5c6b7a]">
                      <time dateTime={entry.at}>{entry.time}</time>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">{entry.actor || "—"}</td>
                    <td className="px-5 py-3.5">{entry.project || "—"}</td>
                    <td className="px-5 py-3.5">{describeLog(entry)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                {selected.actor ? ` · Changed by ${selected.actor}` : ""}
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
