"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/page-header";

type ArchivedProject = {
  id: string;
  name: string;
  projectName: string;
  status: string;
  deadline: string;
  assignees?: string[];
};

export default function ArchivePage({ viewerName }: { viewerName: string }) {
  const [projects, setProjects] = useState<ArchivedProject[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/projects?archived=1")
      .then((response) => (response.ok ? response.json() : { projects: [] }))
      .then((body: { projects?: ArchivedProject[] }) => {
        if (active) setProjects(body.projects ?? []);
      })
      .catch(() => {
        if (active) setProjects([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function reopen(project: ArchivedProject) {
    setBusyId(project.id);
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: project.id, restore: true }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Couldn't reopen the project. Try again.");
    } else {
      setError("");
      const body = (await response.json()) as { projects?: ArchivedProject[] };
      setProjects(body.projects ?? []);
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "Restored",
          project: project.projectName,
          employee: project.name,
          detail: "Reopened from the archive",
          message: `${viewerName} reopened ${project.projectName}.`,
        }),
      });
    }
    setBusyId(null);
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#f4f7fb] px-5 py-5 font-sans sm:px-7 sm:py-6">
      <PageHeader
        title="Archive"
        description="Projects moved off the dashboard. Reopen a project to return it to the dashboard."
      />
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#d7e0ea] bg-white shadow-sm">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#e6edf3] px-5 py-4">
          <div className="mr-auto">
            <h2 className="text-sm font-bold tracking-tight text-[#193956]">Archived projects</h2>
            <p className="mt-0.5 text-xs text-[#5c6b7a]">{projects.length} archived</p>
            {error ? <p role="alert" className="mt-1 text-xs text-[#9b2c2c]">{error}</p> : null}
          </div>
          <a
            href="/api/export/projects?archived=1"
            download
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#d7e0ea] bg-white px-3 text-xs font-semibold text-[#385875] transition hover:border-[#385875] hover:bg-[#eef3f8]"
          >
            <i className="bi bi-download" aria-hidden="true" />
            Export CSV
          </a>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#e6edf3] bg-[#f8fafc] text-[#5c6b7a]">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Owner</th>
                <th scope="col" className="px-5 py-3 font-medium">Project</th>
                <th scope="col" className="px-5 py-3 font-medium">IT staff</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-sm text-[#5c6b7a]">
                    Nothing archived. Projects you archive from the dashboard will appear here.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="border-t border-[#eef2f6] text-[#193956] transition-colors hover:bg-[#f5f9fd]">
                    <td className="px-5 py-3.5 align-top whitespace-nowrap">{project.name}</td>
                    <td className="px-5 py-3.5 align-top font-medium">{project.projectName}</td>
                    <td className="px-5 py-3.5 align-top text-[#5c6b7a]">
                      {(project.assignees ?? []).length > 0 ? (
                        <ul className="space-y-1">
                          {project.assignees?.map((name) => (
                            <li key={name} className="whitespace-nowrap leading-5">
                              {name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[#8aa0b3] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 align-top whitespace-nowrap">{project.status}</td>
                    <td className="px-5 py-3.5 text-right align-top">
                      <button
                        type="button"
                        disabled={busyId === project.id}
                        onClick={() => void reopen(project)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#d7e0ea] px-2.5 py-1 text-xs font-semibold text-[#1d4e89] transition hover:border-[#1d4e89] hover:bg-[#e8f1fb] disabled:opacity-50"
                      >
                        <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
                        {busyId === project.id ? "Reopening…" : "Reopen"}
                      </button>
                    </td>
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
