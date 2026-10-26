"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import DepartmentLoading from "@/components/department-loading";
import PageHeader from "@/components/page-header";
import Modal from "@/components/modal";
import { Pagination, SortHeader, compareValues, nextSort, type SortState } from "@/components/table-controls";
import type { ActivityLog } from "@/lib/activity-logs.ts";
import { canAnnounceNotes, canEditProject, type AccessLevel } from "@/lib/sso/access.ts";
import { ROLE_LABELS } from "@/lib/access-rules.ts";

type ProjectForm = {
  name: string;
  projectName: string;
  projectLink: string;
  trelloLink: string;
  status: string;
  progress: string;
  deadline: string;
  assignees: string[];
  notes: string;
};

const emptyForm: ProjectForm = {
  name: "",
  projectName: "",
  projectLink: "",
  trelloLink: "",
  status: "Under Review",
  progress: "0",
  deadline: "",
  assignees: [],
  notes: "",
};

type Project = {
  id: string;
  name: string;
  projectName: string;
  projectLink: string;
  trelloLink: string;
  status: string;
  progress: number;
  deadline: string;
  notes: string;
};

type ItStaff = { id: number; name: string; title: string };

type SortKey = "name" | "projectName" | "status" | "progress" | "deadline";

const statusStyles: Record<string, string> = {
  "In Progress": "bg-[#e8f1fb] text-[#1d4e89]",
  "Under Review": "bg-[#fff6df] text-[#8a5b00]",
  Completed: "bg-[#e7f6ee] text-[#1f7a45]",
};

const deadlineFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default function Homepage({
  viewer,
  hrmsUrl = "",
}: {
  viewer: { name: string; access: AccessLevel; position: string };
  hrmsUrl?: string;
}) {
  const [selected, setSelected] = useState<Project | null>(null);
  const [assignedBy, setAssignedBy] = useState<Record<string, string[]>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [projectRows, setProjectRows] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [addForm, setAddForm] = useState<ProjectForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProjectForm>(emptyForm);
  const [notifications, setNotifications] = useState<
    { id: string; message: string; time: string; actor: string; unread: boolean }[]
  >([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [itStaff, setItStaff] = useState<ItStaff[]>([]);
  const [booting, setBooting] = useState(true);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "deadline", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionError, setActionError] = useState("");
  const [modalTab, setModalTab] = useState<"details" | "activity">("details");
  const [projectLogs, setProjectLogs] = useState<ActivityLog[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/notifications").then((response) => (response.ok ? response.json() : { notifications: [] })),
      fetch("/api/projects").then((response) => (response.ok ? response.json() : { projects: [] })),
      fetch("/api/it-staff").then((response) => (response.ok ? response.json() : { staff: [] })),
    ])
      .then(([notes, projectsBody, staffBody]: [
        { notifications?: { id: number; message: string; time: string; actor: string; unread?: boolean }[] },
        { projects?: (Project & { assignees?: string[] })[] },
        { staff?: ItStaff[] },
      ]) => {
        if (!active) return;
        setNotifications(
          (notes.notifications ?? []).map((item) => ({
            id: String(item.id),
            message: item.message,
            time: item.time,
            actor: item.actor,
            unread: item.unread !== false,
          })),
        );
        applyProjects(projectsBody.projects ?? []);
        setItStaff(staffBody.staff ?? []);
      })
      .catch(() => {
        if (!active) return;
        setNotifications([]);
        applyProjects([]);
        setItStaff([]);
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function applyProjects(
    projects: (Project & { assignees?: string[] })[],
  ) {
    setProjectRows(projects);
    setStatuses(Object.fromEntries(projects.map((project) => [project.id, project.status])));
    setAssignedBy(
      Object.fromEntries(projects.map((project) => [project.id, project.assignees ?? []])),
    );
  }

  const canEdit = (project: Project) =>
    canEditProject(viewer, { owner: project.name, assignees: assignedBy[project.id] ?? [] });

  function notify(input: {
    action: string;
    project: string;
    projectId?: string;
    employee?: string;
    detail?: string;
    message: string;
  }) {
    void fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: input.action,
        project: input.project,
        projectId: input.projectId ?? "",
        employee: input.employee ?? "",
        detail: input.detail ?? "",
        message: input.message,
      }),
    });
    const recipient = input.employee?.trim() ?? "";
    if (
      (input.action === "Assigned" || input.action === "Removed") &&
      recipient &&
      recipient.toLowerCase() !== viewer.name.trim().toLowerCase()
    ) {
      void fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, message: input.message }),
      });
    }
  }

  function notifyAssignmentChange(
    projectId: string,
    projectLabel: string,
    previous: string[],
    next: string[],
  ) {
    for (const name of next.filter((person) => !previous.includes(person))) {
      notify({
        action: "Assigned",
        project: projectLabel,
        projectId,
        employee: name,
        detail: `${name} was assigned`,
        message: `${name} was assigned as IT staff on ${projectLabel}.`,
      });
    }
    for (const name of previous.filter((person) => !next.includes(person))) {
      notify({
        action: "Removed",
        project: projectLabel,
        projectId,
        employee: name,
        detail: `${name} was removed`,
        message: `${name} was removed from the IT staff on ${projectLabel}.`,
      });
    }
  }

  async function removeProject(project: Project) {
    if (!canEdit(project)) return;
    if (!window.confirm(`Archive ${project.projectName}? You can reopen it from the Archive page.`)) return;
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: project.id }),
    });
    if (!response.ok) {
      setActionError(await readError(response, "Couldn't archive the project. Try again."));
      return;
    }
    setActionError("");
    const body = (await response.json()) as { projects?: (Project & { assignees?: string[] })[] };
    applyProjects(body.projects ?? []);
    notify({
      action: "Archived",
      project: project.projectName,
      projectId: project.id,
      employee: project.name,
      detail: "Moved to the archive",
      message: `${viewer.name} archived ${project.projectName}.`,
    });
  }

  async function persist(project: Project, assignees: string[]) {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: { ...project, assignees } }),
    });
    if (!response.ok) {
      setSaveError(await readError(response, "Couldn't save the project. Check your connection and try again."));
      return false;
    }
    setSaveError("");
    const body = (await response.json()) as { projects?: (Project & { assignees?: string[] })[] };
    applyProjects(body.projects ?? []);
    return true;
  }

  useEffect(() => {
    if (!selected || modalTab !== "activity") return;
    let active = true;
    fetch(`/api/logs?projectId=${encodeURIComponent(selected.id)}&project=${encodeURIComponent(selected.projectName)}`)
      .then((response) => (response.ok ? response.json() : { logs: [] }))
      .then((body: { logs?: ActivityLog[] }) => {
        if (active) setProjectLogs(body.logs ?? []);
      })
      .catch(() => {
        if (active) setProjectLogs([]);
      });
    return () => {
      active = false;
    };
  }, [selected, modalTab]);

  function openDetails(project: Project) {
    setModalTab("details");
    setProjectLogs(null);
    setSelected(project);
  }

  async function readError(response: Response, fallback: string) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return body?.error || fallback;
  }

  useEffect(() => {
    if (!selected && !adding && !editingId && !notificationsOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSelected(null);
      setAdding(false);
      setEditingId(null);
      setNotificationsOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected, adding, editingId, notificationsOpen]);

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const projectName = addForm.projectName.trim();
    const name = viewer.name.trim();
    if (!projectName || !name || !addForm.deadline) return;

    const progress = Math.min(100, Math.max(0, Number(addForm.progress) || 0));
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      projectName,
      projectLink: addForm.projectLink.trim(),
      trelloLink: addForm.trelloLink.trim(),
      status: addForm.status,
      progress,
      deadline: addForm.deadline,
      notes: addForm.notes.trim(),
    };

    setSaveError("");
    void persist(project, addForm.assignees).then((saved) => {
      if (!saved) return;
    notify({
      action: "Added",
      project: project.projectName,
      projectId: project.id,
      employee: project.name,
      detail: `${project.status}, ${project.progress}% progress`,
      message: `${viewer.name} added ${project.projectName}.`,
    });
    notifyAssignmentChange(project.id, project.projectName, [], addForm.assignees);
    setAddForm(emptyForm);
    setAdding(false);
    });
  }

  function openEdit(project: Project) {
    setSaveError("");
    setEditingId(project.id);
    setEditForm({
      name: project.name,
      projectName: project.projectName,
      projectLink: project.projectLink,
      trelloLink: project.trelloLink,
      status: statuses[project.id] ?? project.status,
      progress: String(project.progress),
      deadline: project.deadline,
      assignees: assignedBy[project.id] ?? [],
      notes: project.notes,
    });
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    const editing = projectRows.find((project) => project.id === editingId);
    if (!editing || !canEdit(editing)) return;
    const projectName = editForm.projectName.trim();
    const name = editForm.name.trim();
    if (!projectName || !name || !editForm.deadline) return;

    const progress = Math.min(100, Math.max(0, Number(editForm.progress) || 0));
    const previous = projectRows.find((project) => project.id === editingId);
    const previousAssignees = assignedBy[editingId] ?? [];
    const nextNotes = editForm.notes.trim();
    const nextProject: Project = {
      id: editingId,
      name,
      projectName,
      projectLink: editForm.projectLink.trim(),
      trelloLink: editForm.trelloLink.trim(),
      status: editForm.status,
      progress,
      deadline: editForm.deadline,
      notes: nextNotes,
    };
    void persist(nextProject, editForm.assignees).then((saved) => {
      if (!saved || !previous) return;
    const previousStatus = statuses[editingId] ?? previous.status;
    const statusChanged = previousStatus !== editForm.status;
    const progressChanged = previous.progress !== progress;
    if (statusChanged) {
      notify({
        action: "Status changed",
        project: projectName,
        projectId: editingId,
        employee: name,
        detail: `${previousStatus} to ${editForm.status}`,
        message: `${projectName} status changed to ${editForm.status}.`,
      });
    }
    const changed: string[] = [];
    if (previous.name !== name) changed.push("owner");
    if (previous.projectName !== projectName) changed.push("project name");
    if (previous.projectLink !== nextProject.projectLink) changed.push("website");
    if (previous.trelloLink !== nextProject.trelloLink) changed.push("Trello");
    if (previous.deadline !== nextProject.deadline) changed.push("deadline");
    if (progressChanged) changed.push(`progress to ${progress}%`);
    if (changed.length > 0) {
      notify({
        action: "Updated",
        project: projectName,
        projectId: editingId,
        employee: name,
        detail: changed.join(", "),
        message: `${projectName} was updated.`,
      });
    }
    if (previous && previous.notes !== nextNotes && canAnnounceNotes(viewer)) {
      notify({
        action: previous.notes ? "Note updated" : "Note added",
        project: projectName,
        projectId: editingId,
        employee: name,
        detail: nextNotes || "Note removed",
        message: `Note changed on ${projectName}.`,
      });
    }
    notifyAssignmentChange(editingId, projectName, previousAssignees, editForm.assignees);
    setEditingId(null);
    });
  }

  const visibleNotifications = notifications.filter(
    (item) => item.actor.trim().toLowerCase() !== viewer.name.trim().toLowerCase(),
  );
  const unreadCount = visibleNotifications.filter((item) => item.unread !== false).length;
  const searchText = search.trim().toLowerCase();
  const visibleRows = projectRows.filter((project) => {
    const statusMatches = statusFilter === "All" || statuses[project.id] === statusFilter;
    if (!statusMatches) return false;
    if (!searchText) return true;
    const assignees = assignedBy[project.id] ?? [];
    return (
      project.projectName.toLowerCase().includes(searchText) ||
      project.name.toLowerCase().includes(searchText) ||
      assignees.some((name) => name.toLowerCase().includes(searchText))
    );
  });
  const sortedRows = [...visibleRows].sort((a, b) => {
    const pick = (project: Project): string | number =>
      sort.key === "status" ? statuses[project.id] ?? project.status : project[sort.key];
    const result = compareValues(pick(a), pick(b));
    return sort.dir === "asc" ? result : -result;
  });
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const onSort = (key: SortKey) => {
    setSort((current) => nextSort(current, key));
    setPage(1);
  };
  const summaryCards = [
    { label: "Total projects", value: "All", count: projectRows.length },
    ...Object.keys(statusStyles).map((status) => ({
      label: status,
      value: status,
      count: projectRows.filter((project) => statuses[project.id] === status)
        .length,
    })),
  ];

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-[#f4f7fb] px-5 py-5 font-sans sm:px-7 sm:py-6">
      {booting ? (
        <div className="absolute inset-0 z-30 flex bg-[#f4f7fb]">
          <DepartmentLoading />
        </div>
      ) : null}
      <PageHeader
        title="Projects dashboard"
        description="Track every IT project at a glance: owner, assigned staff, progress, and deadline. Click a row to see its details."
      >
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {hrmsUrl ? (
          <a
            href={hrmsUrl}
            aria-label="Back to HRMS Dashboard"
            title="Back to HRMS Dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#d7e0ea] bg-white px-3 text-sm font-semibold text-[#193956] shadow-sm transition hover:-translate-y-0.5 hover:border-[#193956] hover:bg-[#f5f9fd] focus-visible:ring-2 focus-visible:ring-[#1d4e89]/40 focus-visible:outline-none sm:px-4"
          >
            <i className="bi bi-arrow-left-circle text-base" aria-hidden="true" />
            <span className="hidden sm:inline">Back to HRMS Dashboard</span>
            <span className="sm:hidden">HRMS</span>
          </a>
        ) : null}
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => {
            setNotificationsOpen(true);
            if (unreadCount === 0) return;
            setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
            void fetch("/api/notifications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ read: true }),
            });
          }}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d7e0ea] bg-white text-[#193956] shadow-sm transition hover:-translate-y-0.5 hover:border-[#193956]"
        >
          <BellIcon />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F0B429] px-1 text-[10px] font-semibold text-[#193956]">
              {unreadCount}
            </span>
          ) : null}
        </button>
        </div>
      </PageHeader>
      <div
        className="mb-5 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-5"
        role="group"
        aria-label="Filter by status"
      >
        {summaryCards.map((card, index) => {
          const active = statusFilter === card.value;
          return (
            <motion.button
              key={card.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setStatusFilter(card.value);
                setPage(1);
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: index * 0.04 }}
              className={`rounded-xl border px-4 py-3.5 text-left shadow-sm transition ${
                active
                  ? "border-[#193956] bg-[#193956] text-white"
                  : "border-[#d7e0ea] bg-white text-[#193956] hover:-translate-y-0.5 hover:border-[#385875]"
              }`}
            >
              <span
                className={`block text-xs font-medium ${active ? "text-[#AFC0D0]" : "text-[#5c6b7a]"}`}
              >
                {card.label}
              </span>
              <span className="mt-2 block text-3xl font-semibold tracking-tight tabular-nums">
                {card.count}
              </span>
            </motion.button>
          );
        })}
      </div>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#d7e0ea] bg-white shadow-sm">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#e6edf3] px-5 py-4">
          <div className="mr-auto">
            <h2 className="text-sm font-bold tracking-tight text-[#193956]">Projects</h2>
            <p className="mt-0.5 text-xs text-[#5c6b7a]">
              Showing {visibleRows.length} of {projectRows.length}
            </p>
            {actionError ? <p role="alert" className="mt-1 text-xs text-[#9b2c2c]">{actionError}</p> : null}
          </div>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by project, owner, or staff"
            aria-label="Search projects"
            className="h-10 w-full max-w-xs flex-1 rounded-lg border border-[#d7e0ea] bg-[#f8fafc] px-3 text-sm text-[#193956] outline-none transition placeholder:text-[#8aa0b3] focus:border-[#1d4e89] focus:bg-white focus:ring-2 focus:ring-[#1d4e89]/15"
          />
          <span title="Your role in IT Department" className="inline-flex items-center gap-1 rounded-full border border-[#d7e0ea] bg-[#eef3f8] px-2.5 py-1 text-xs font-semibold text-[#385875]"><i className={`bi ${viewer.access === "viewer" ? "bi-eye" : "bi-person-badge"}`} aria-hidden="true" />{ROLE_LABELS[viewer.access]}</span>
          <a
            hidden={viewer.access === "viewer"}
            href="/api/export/projects"
            download
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[#d7e0ea] bg-white px-3 text-xs font-semibold text-[#385875] transition hover:border-[#385875] hover:bg-[#eef3f8]"
          >
            <i className="bi bi-download" aria-hidden="true" />
            Export CSV
          </a>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#e6edf3] bg-[#f8fafc] text-[#5c6b7a]">
              <tr>
                <SortHeader label="Owner" sortKey="name" sort={sort} onSort={onSort} className="sticky left-0 bg-[#f8fafc]" />
                <SortHeader label="Project" sortKey="projectName" sort={sort} onSort={onSort} />
                <th scope="col" className="px-5 py-3 font-medium whitespace-nowrap">
                  IT staff
                </th>
                <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
                <SortHeader label="Progress" sortKey="progress" sort={sort} onSort={onSort} />
                <SortHeader label="Deadline" sortKey="deadline" sort={sort} onSort={onSort} />
                <th
                  scope="col"
                  className="px-5 py-3 text-right font-medium whitespace-nowrap"
                >
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-20 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef3f8] text-[#385875]">
                        <i className={`bi ${projectRows.length === 0 ? "bi-folder-plus" : "bi-search"} text-lg`} aria-hidden="true" />
                      </span>
                      <p className="text-sm font-semibold text-[#193956]">
                        {projectRows.length === 0 ? "No projects yet" : "No matching projects"}
                      </p>
                      <p className="text-xs leading-5 text-[#5c6b7a]">
                        {projectRows.length === 0
                          ? "Click New project to add the first one."
                          : searchText
                            ? "Try a different project, owner, or staff name."
                            : "No projects have this status right now."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {pagedRows.map((project) => (
                <tr
                  key={project.id}
                  tabIndex={0}
                  aria-label={`View details for ${project.projectName}`}
                  onClick={() => openDetails(project)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDetails(project);
                    }
                  }}
                  className="group cursor-pointer border-t border-[#eef2f6] text-[#193956] outline-none transition-colors focus-visible:bg-[#f1f6fb] focus-visible:ring-2 focus-visible:ring-[#1d4e89]/40 focus-visible:ring-inset"
                >
                  <td className="sticky left-0 bg-white px-5 py-3.5 align-top whitespace-nowrap group-hover:bg-[#f5f9fd] group-focus-visible:bg-[#f1f6fb]">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c9973a] text-[11px] font-bold text-white shadow-[0_0_0_2px_rgba(201,151,58,0.25)]">
                        {initials(project.name)}
                      </span>
                      {project.name}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 align-top font-medium group-hover:bg-[#f5f9fd] group-focus-visible:bg-[#f1f6fb]">
                    {project.projectName}
                  </td>
                  <td className="px-5 py-3.5 align-top text-[#5c6b7a] group-hover:bg-[#f5f9fd] group-focus-visible:bg-[#f1f6fb]">
                    {(assignedBy[project.id] ?? []).length > 0 ? (
                      <ul className="space-y-1">
                        {assignedBy[project.id].map((name) => (
                          <li key={name} className="whitespace-nowrap leading-5">
                            {name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-[#8aa0b3] italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 align-top whitespace-nowrap group-hover:bg-[#f5f9fd] group-focus-visible:bg-[#f1f6fb]">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[statuses[project.id]] ?? "bg-[#fff6df] text-[#8a5b00]"}`}
                    >
                      {statuses[project.id]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 align-top group-hover:bg-[#f5f9fd] group-focus-visible:bg-[#f1f6fb]">
                    <div className="flex min-w-36 items-center gap-3">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6edf3]"
                        role="presentation"
                      >
                        <div
                          className={`h-full rounded-full ${project.progress >= 50 ? "bg-[#1f8a4c]" : "bg-[#e07a1a]"}`}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span
                        className={`w-9 shrink-0 text-xs font-medium tabular-nums ${project.progress >= 50 ? "text-[#1f8a4c]" : "text-[#e07a1a]"}`}
                      >
                        {project.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 align-top whitespace-nowrap text-[#5c6b7a] group-hover:bg-[#f5f9fd] group-focus-visible:bg-[#f1f6fb]">
                    <time dateTime={project.deadline}>
                      {deadlineFormat.format(new Date(project.deadline))}
                    </time>
                  </td>
                  <td className="px-5 py-3.5 align-top whitespace-nowrap group-hover:bg-[#f5f9fd] group-focus-visible:bg-[#f1f6fb]">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openDetails(project)}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-[#1d4e89] transition hover:bg-[#e8f1fb]"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        hidden={!canEdit(project)}
                        onClick={() => openEdit(project)}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-[#385875] transition hover:bg-[#eef3f8]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        hidden={!canEdit(project)}
                        onClick={() => void removeProject(project)}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-[#9b2c2c] transition hover:bg-[#fdecec]"
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sortedRows.length > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={sortedRows.length}
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
          labelledBy="project-links-title"
          onClose={() => setSelected(null)}
          className="w-full max-w-lg rounded-2xl border border-[#d7e0ea] bg-white shadow-2xl"
        >
            <header className="flex items-start justify-between gap-4 border-b border-[#e6edf3] px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8aa0b3] uppercase">
                  Owned by {selected.name}
                </p>
                <h2
                  id="project-links-title"
                  className="mt-1.5 text-xl font-semibold tracking-tight text-[#193956]"
                >
                  {selected.projectName}
                </h2>
                <p className="mt-2 text-sm text-[#5c6b7a]">
                  {statuses[selected.id]} · {selected.progress}% complete · Due {deadlineFormat.format(new Date(selected.deadline))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="rounded-lg px-2.5 py-1.5 text-sm text-[#5c6b7a] transition hover:bg-[#f5f7fa] hover:text-[#193956]"
              >
                Close
              </button>
            </header>
            <div role="tablist" aria-label="Project sections" className="flex gap-1 border-b border-[#e6edf3] px-6">
              {(["details", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={modalTab === tab}
                  onClick={() => setModalTab(tab)}
                  className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold capitalize transition ${
                    modalTab === tab
                      ? "border-[#c9973a] text-[#193956]"
                      : "border-transparent text-[#8aa0b3] hover:text-[#385875]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {modalTab === "activity" ? (
              <div role="tabpanel" className="max-h-[50vh] overflow-y-auto px-6 py-5">
                {projectLogs === null ? (
                  <p className="text-sm text-[#5c6b7a]">Loading activity…</p>
                ) : projectLogs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[#5c6b7a]">No activity recorded for this project yet.</p>
                ) : (
                  <ol className="relative flex flex-col gap-4 border-l border-[#e6edf3] pl-4">
                    {projectLogs.map((log) => (
                      <li key={log.id} className="relative">
                        <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-white bg-[#c9973a]" aria-hidden="true" />
                        <p className="text-sm text-[#193956]">
                          <span className="font-semibold">{log.action}</span>
                          {log.detail ? ` · ${log.detail}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-[#5c6b7a]">
                          <time dateTime={log.at}>{log.time}</time>
                          {log.actor ? ` · by ${log.actor}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
            <div role="tabpanel" className="flex flex-col gap-5 px-6 py-5">
              <div>
                <p className="text-xs font-medium text-[#5c6b7a]">Assigned IT staff</p>
                <p className="mt-1.5 text-sm text-[#193956]">
                  {(assignedBy[selected.id] ?? []).length > 0
                    ? assignedBy[selected.id].join(", ")
                    : "No IT staff assigned yet."}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#5c6b7a]">Website</p>
                {selected.projectLink.startsWith("http://") || selected.projectLink.startsWith("https://") ? (
                  <a
                    href={selected.projectLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 block break-all text-sm text-[#1d4e89] underline decoration-[#1d4e89]/30 underline-offset-4 hover:decoration-[#1d4e89]"
                  >
                    {selected.projectLink}
                  </a>
                ) : (
                  <p className="mt-1.5 text-sm text-[#8aa0b3]">No website link added.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-[#5c6b7a]">Trello</p>
                {selected.trelloLink.startsWith("http://") || selected.trelloLink.startsWith("https://") ? (
                  <a
                    href={selected.trelloLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 block break-all text-sm text-[#1d4e89] underline decoration-[#1d4e89]/30 underline-offset-4 hover:decoration-[#1d4e89]"
                  >
                    {selected.trelloLink}
                  </a>
                ) : (
                  <p className="mt-1.5 text-sm text-[#8aa0b3]">No Trello board linked.</p>
                )}
              </div>
              <div className="rounded-xl bg-[#f4f7fb] px-4 py-3">
                <p className="text-xs font-medium text-[#5c6b7a]">Notes</p>
                <p className="mt-1.5 text-sm leading-6 whitespace-pre-wrap text-[#193956]">
                  {selected.notes || "No notes for this project."}
                </p>
              </div>
            </div>
            )}
        </Modal>
      ) : null}

      {notificationsOpen ? (
        <Modal
          labelledBy="notifications-title"
          onClose={() => setNotificationsOpen(false)}
          className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-[#d7e0ea] bg-white shadow-2xl"
        >
            <header className="flex items-center justify-between border-b border-[#e6edf3] px-5 py-4">
              <h2
                id="notifications-title"
                className="text-lg font-semibold text-[#193956]"
              >
                Notifications
              </h2>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-[#5c6b7a] hover:bg-[#f5f7fa] hover:text-[#193956]"
              >
                Close
              </button>
            </header>
            <div className="overflow-y-auto px-5 py-4">
              {visibleNotifications.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#5c6b7a]">You&apos;re all caught up. New updates will appear here.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {visibleNotifications.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-[#e6edf3] px-3 py-3"
                    >
                      <p className="text-sm text-[#193956]">{item.message}</p>
                      <p className="mt-1 text-xs text-[#5c6b7a]">{item.time}</p>
                      <p className="text-xs text-[#5c6b7a]">
                        {item.actor ? `Changed by ${item.actor}` : "Changed by unknown account"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
        </Modal>
      ) : null}
      </AnimatePresence>

      <button
        type="button"
        hidden={viewer.access === "viewer"}
        onClick={() => setAdding(true)}
        aria-label="New project"
        className="fixed right-7 bottom-7 z-40 flex h-12 items-center gap-2 rounded-full bg-[#193956] px-5 text-sm font-medium text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#385875]"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          +
        </span>
        New project
      </button>

      <AnimatePresence>
      {editingId ? (
        <Modal
          labelledBy="edit-project-title"
          onClose={() => setEditingId(null)}
          className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#d7e0ea] bg-white shadow-2xl"
        >
          <form
            onSubmit={saveEdit}
          >
            <header className="border-b border-[#e6edf3] px-5 py-4">
              <h2
                id="edit-project-title"
                className="text-lg font-semibold text-[#193956]"
              >
                Edit project
              </h2>
              <p className="mt-0.5 text-xs text-[#5c6b7a]">Changes are logged and shared with assigned staff.</p>
            </header>
            <ProjectFields form={editForm} onChange={setEditForm} includeLinks staff={itStaff} />
            <div className="flex justify-end gap-2 border-t border-[#e6edf3] px-5 py-4">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c6b7a] hover:bg-[#f5f7fa] hover:text-[#193956]"
              >
                Cancel
              </button>
              {saveError ? <p role="alert" className="order-first mr-auto text-xs text-[#9b2c2c]">{saveError}</p> : null}
              <button
                type="submit"
                className="rounded-lg bg-[#193956] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#385875]"
              >
                Save changes
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {adding ? (
        <Modal
          labelledBy="add-project-title"
          onClose={() => setAdding(false)}
          className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#d7e0ea] bg-white shadow-2xl"
        >
          <form
            onSubmit={addProject}
          >
            <header className="flex items-center justify-between border-b border-[#e6edf3] px-5 py-4">
              <h2
                id="add-project-title"
                className="text-lg font-semibold text-[#193956]"
              >
                New project
              </h2>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-md px-2 py-1 text-sm text-[#5c6b7a] hover:bg-[#f5f7fa] hover:text-[#193956]"
              >
                Close
              </button>
            </header>
            <ProjectFields
              form={addForm}
              onChange={setAddForm}
              includeLinks
              staff={itStaff}
              showEmployee={false}
            />
            <div className="flex items-center justify-end gap-3 border-t border-[#e6edf3] px-5 py-4">
              {saveError ? <p className="mr-auto text-xs text-[#9b2c2c]">{saveError}</p> : null}
              <button
                type="submit"
                className="rounded-lg bg-[#193956] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#385875]"
              >
                Create project
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      </AnimatePresence>
    </div>
  );
}

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase());
  return letters.join("") || "?";
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ProjectFields({
  form,
  onChange,
  includeLinks = false,
  staff,
  showEmployee = true,
}: {
  form: ProjectForm;
  onChange: (next: ProjectForm) => void;
  includeLinks?: boolean;
  staff: ItStaff[];
  showEmployee?: boolean;
}) {
  const [staffOpen, setStaffOpen] = useState(false);
  const fieldClass =
    "h-10 rounded-lg border border-[#d7e0ea] bg-white px-3 text-sm text-[#193956] outline-none transition focus:border-[#1d4e89] focus:ring-2 focus:ring-[#1d4e89]/15";

  return (
    <div className="grid gap-4 px-6 py-5">
      {showEmployee ? (
        <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
          Owner
          <select
            required
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            className={fieldClass}
          >
            <option value="">Select the project owner</option>
            {staff.map((person) => (
              <option key={person.id} value={person.name}>
                {person.name}
                {person.title ? ` — ${person.title}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
        Project name
        <input
          required
          placeholder="e.g. HRMS payroll module"
          value={form.projectName}
          onChange={(event) =>
            onChange({ ...form, projectName: event.target.value })
          }
          className={fieldClass}
        />
      </label>
      <div className="grid gap-1">
        <span className="text-xs font-medium text-[#5c6b7a]">
          Assigned IT staff
        </span>
        <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={staffOpen}
            onClick={() => setStaffOpen((open) => !open)}
            className="flex h-10 w-full items-center justify-between rounded-lg border border-[#d7e0ea] bg-white px-3 text-left text-sm text-[#193956]"
          >
            <span className="truncate">
              {form.assignees.length > 0
                ? form.assignees.join(", ")
                : "Select IT staff"}
            </span>
            {staffOpen ? (
              <span className="shrink-0 text-xs font-medium text-[#1d4e89]">Close</span>
            ) : (
              <span aria-hidden="true" className="text-[#8aa0b3]">
                ▾
              </span>
            )}
          </button>
          {staffOpen ? (
            <ul
              role="listbox"
              aria-multiselectable="true"
              className="absolute z-20 mt-1 w-full rounded-md border border-[#d7e0ea] bg-white py-1 shadow-lg"
            >
              {staff.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[#5c6b7a]">No IT employees found.</li>
              ) : null}
              {staff.map((person) => {
                const selected = form.assignees.includes(person.name);
                return (
                  <li key={person.name} role="option" aria-selected={selected}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[#f5f7fa]">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          onChange({
                            ...form,
                            assignees: selected
                              ? form.assignees.filter(
                                  (name) => name !== person.name,
                                )
                              : [...form.assignees, person.name],
                          })
                        }
                        className="accent-[#1d4e89]"
                      />
                      <span>
                        <span className="block font-medium text-[#193956]">
                          {person.name}
                        </span>
                        <span className="block text-xs text-[#5c6b7a]">
                          {person.title}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
              <li className="border-t border-[#e6edf3] px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setStaffOpen(false)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-[#5c6b7a] hover:bg-[#f5f7fa] hover:text-[#193956]"
                >
                  Close
                </button>
              </li>
            </ul>
          ) : null}
        </div>
      </div>
      <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
        Status
        <select
          value={form.status}
          onChange={(event) => onChange({ ...form, status: event.target.value })}
          className={fieldClass}
        >
          {Object.keys(statusStyles).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
        Progress (%)
        <input
          type="number"
          min={0}
          max={100}
          required
          value={form.progress}
          onChange={(event) =>
            onChange({ ...form, progress: event.target.value })
          }
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
        Deadline
        <input
          type="date"
          required
          value={form.deadline}
          onChange={(event) =>
            onChange({ ...form, deadline: event.target.value })
          }
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
        Notes
        <textarea
          value={form.notes}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
          rows={3}
          placeholder="Context, blockers, or next steps"
          className="rounded-lg border border-[#d7e0ea] px-3 py-2.5 text-sm leading-6 text-[#193956] outline-none transition focus:border-[#1d4e89] focus:ring-2 focus:ring-[#1d4e89]/15"
        />
      </label>
      {includeLinks ? (
        <>
          <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
            Website link
            <input
              type="url"
              placeholder="https://"
              value={form.projectLink}
              onChange={(event) =>
                onChange({ ...form, projectLink: event.target.value })
              }
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
            Trello board link
            <input
              type="url"
              placeholder="https://trello.com/b/..."
              value={form.trelloLink}
              onChange={(event) =>
                onChange({ ...form, trelloLink: event.target.value })
              }
              className={fieldClass}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}

