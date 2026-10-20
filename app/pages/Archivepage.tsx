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
    if (response.ok) {
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
        description="Projects removed from the dashboard. Reopen one to put it back on the homepage."
      />
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#d7e0ea] bg-white shadow-sm">
        <header className="shrink-0 border-b border-[#e6edf3] px-5 py-4">
          <h2 className="text-sm font-bold tracking-tight text-[#193956]">Archived projects</h2>
          <p className="mt-0.5 text-xs text-[#5c6b7a]">{projects.length} archived</p>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#193956] text-[#F5F7FA]">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Employee</th>
                <th scope="col" className="px-5 py-3 font-medium">Project</th>
                <th scope="col" className="px-5 py-3 font-medium">Assigned IT Staff</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-sm text-[#5c6b7a]">
                    No archived projects.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="border-t border-[#e6edf3] text-[#193956]">
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
                        "No IT staff assigned"
                      )}
                    </td>
                    <td className="px-5 py-3.5 align-top whitespace-nowrap">{project.status}</td>
                    <td className="px-5 py-3.5 align-top">
                      <button
                        type="button"
                        disabled={busyId === project.id}
                        onClick={() => void reopen(project)}
                        className="text-xs font-medium text-[#1d4e89] underline decoration-[#1d4e89]/30 underline-offset-2 hover:decoration-[#1d4e89] disabled:opacity-50"
                      >
                        Reopen
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
