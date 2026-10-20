"use client";

import { useEffect, useState } from "react";
import { readHistory, type HistoryEntry } from "@/lib/history.ts";

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(readHistory());
  }, []);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#f5f7fa] px-4 pt-4 font-sans sm:px-6 sm:pt-6">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl border border-b-0 border-[#d7e0ea] bg-white">
        <header className="shrink-0 border-b border-[#d7e0ea] px-5 py-4">
          <h1 className="text-lg font-semibold text-[#193956]">History</h1>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#193956] text-[#F5F7FA]">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium whitespace-nowrap">
                  When
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Activity
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-10 text-center text-sm text-[#5c6b7a]">
                    No history yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-[#e6edf3] text-[#193956]">
                    <td className="px-5 py-3.5 whitespace-nowrap text-[#5c6b7a]">
                      <time dateTime={entry.at}>{entry.time}</time>
                    </td>
                    <td className="px-5 py-3.5">{entry.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
