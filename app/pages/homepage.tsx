"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import Modal from "@/components/modal";
import { recordHistory } from "@/lib/history.ts";
import { canAnnounceNotes, canEditProject, type AccessLevel } from "@/lib/sso/access.ts";

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
  status: "Not started",
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

const statusStyles: Record<string, string> = {
  "In Progress": "bg-[#e8f1fb] text-[#1d4e89]",
  "Under Review": "bg-[#fff6df] text-[#8a5b00]",
  Completed: "bg-[#e7f6ee] text-[#1f7a45]",
  "Not started": "bg-[#eef2f6] text-[#5c6b7a]",
};

const deadlineFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default function Homepage({
  viewer,
}: {
  viewer: { name: string; access: AccessLevel; position: string };
}) {
  const [selected, setSelected] = useState<Project | null>(null);
  const [assignedBy, setAssignedBy] = useState<Record<string, string[]>>({});
  const [openAssign, setOpenAssign] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [projectRows, setProjectRows] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<ProjectForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProjectForm>(emptyForm);
  const [notifications, setNotifications] = useState<
    { id: string; message: string; time: string; actor: string }[]
  >([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [itStaff, setItStaff] = useState<ItStaff[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : { notifications: [] }))
      .then((body: { notifications?: { id: number; message: string; time: string; actor: string }[] }) => {
        if (!active) return;
        setNotifications(
          (body.notifications ?? []).map((item) => ({
            id: String(item.id),
            message: item.message,
            time: item.time,
            actor: item.actor,
          })),
        );
      })
      .catch(() => {
        if (active) setNotifications([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/it-staff")
      .then((response) => (response.ok ? response.json() : { staff: [] }))
      .then((body: { staff?: ItStaff[] }) => {
        if (active) setItStaff(body.staff ?? []);
      })
      .catch(() => {
        if (active) setItStaff([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const canEdit = (project: Project) =>
    canEditProject(viewer, { owner: project.name, assignees: assignedBy[project.id] ?? [] });

  function notify(input: {
    action: string;
    project: string;
    employee?: string;
    detail?: string;
    message: string;
  }) {
    recordHistory({
      actor: viewer.name,
      action: input.action,
      project: input.project,
      employee: input.employee ?? "",
      detail: input.detail ?? "",
      message: input.message,
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
    projectLabel: string,
    previous: string[],
    next: string[],
  ) {
    for (const name of next.filter((person) => !previous.includes(person))) {
      notify({
        action: "Assigned",
        project: projectLabel,
        employee: name,
        detail: `${name} was assigned`,
        message: `${name} was assigned as IT staff on ${projectLabel}.`,
      });
    }
    for (const name of previous.filter((person) => !next.includes(person))) {
      notify({
        action: "Removed",
        project: projectLabel,
        employee: name,
        detail: `${name} was removed`,
        message: `${name} was removed from the IT staff on ${projectLabel}.`,
      });
    }
  }

  function toggleDeveloper(projectId: string, developer: string) {
    const target = projectRows.find((project) => project.id === projectId);
    if (!target || !canEdit(target)) return;
    const projectLabel =
      projectRows.find((project) => project.id === projectId)?.projectName ??
      "a project";
    const previous = assignedBy[projectId] ?? [];
    const next = previous.includes(developer)
      ? previous.filter((name) => name !== developer)
      : [...previous, developer];
    setAssignedBy((current) => ({ ...current, [projectId]: next }));
    notifyAssignmentChange(projectLabel, previous, next);
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

    setProjectRows((current) => [...current, project]);
    setStatuses((current) => ({ ...current, [project.id]: project.status }));
    setAssignedBy((current) => ({
      ...current,
      [project.id]: addForm.assignees,
    }));
    notify({
      action: "Added",
      project: project.projectName,
      employee: project.name,
      detail: `${project.status}, ${project.progress}%`,
      message: `${viewer.name} added ${project.projectName}.`,
    });
    notifyAssignmentChange(project.projectName, [], addForm.assignees);
    setAddForm(emptyForm);
    setAdding(false);
  }

  function openEdit(project: Project) {
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
    setProjectRows((current) =>
      current.map((project) =>
        project.id === editingId
          ? {
              ...project,
              name,
              projectName,
              projectLink: editForm.projectLink.trim(),
              trelloLink: editForm.trelloLink.trim(),
              status: editForm.status,
              progress,
              deadline: editForm.deadline,
              notes: nextNotes,
            }
          : project,
      ),
    );
    setStatuses((current) => ({ ...current, [editingId]: editForm.status }));
    setAssignedBy((current) => ({
      ...current,
      [editingId]: editForm.assignees,
    }));
    if (previous && (statuses[editingId] ?? previous.status) !== editForm.status) {
      notify({
        action: "Status changed",
        project: projectName,
        employee: name,
        detail: `${statuses[editingId] ?? previous.status} to ${editForm.status}`,
        message: `${projectName} status changed to ${editForm.status}.`,
      });
    } else if (previous) {
      notify({
        action: "Updated",
        project: projectName,
        employee: name,
        detail: `${editForm.status}, ${progress}%`,
        message: `${projectName} was updated.`,
      });
    }
    if (previous && previous.notes !== nextNotes && canAnnounceNotes(viewer)) {
      notify({
        action: previous.notes ? "Note updated" : "Note added",
        project: projectName,
        employee: name,
        detail: nextNotes || "Note removed",
        message: `Note changed on ${projectName}.`,
      });
    }
    notifyAssignmentChange(projectName, previousAssignees, editForm.assignees);
    setEditingId(null);
  }

  const visibleNotifications = notifications.filter(
    (item) => item.actor.trim().toLowerCase() !== viewer.name.trim().toLowerCase(),
  );
  const visibleRows = projectRows.filter(
    (project) =>
      statusFilter === "All" || statuses[project.id] === statusFilter,
  );
  const summaryCards = [
    { label: "All projects", value: "All", count: projectRows.length },
    ...Object.keys(statusStyles).map((status) => ({
      label: status,
      value: status,
      count: projectRows.filter((project) => statuses[project.id] === status)
        .length,
    })),
  ];

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#f4f7fb] px-5 py-5 font-sans sm:px-7 sm:py-6">
      <div className="mb-4 flex shrink-0 items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[#8aa0b3] uppercase">
            IT Department
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#193956]">
            Project monitoring
          </h1>
          <p className="mt-1 text-sm text-[#5c6b7a]">
            See who owns each project, who is assigned, and what is due.
          </p>
        </div>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setNotificationsOpen(true)}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d7e0ea] bg-white text-[#193956] shadow-sm transition hover:-translate-y-0.5 hover:border-[#193956]"
        >
          <BellIcon />
          {visibleNotifications.length > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F0B429] px-1 text-[10px] font-semibold text-[#193956]">
              {visibleNotifications.length}
            </span>
          ) : null}
        </button>
      </div>
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
              onClick={() => setStatusFilter(card.value)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: index * 0.04 }}
              className={`rounded-2xl border px-4 py-4 text-left shadow-sm transition ${
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
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e6edf3] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#193956]">Projects</h2>
            <p className="mt-0.5 text-xs text-[#5c6b7a]">
              {visibleRows.length} shown
            </p>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#193956] text-[#F5F7FA]">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 bg-[#193956] px-5 py-3 font-medium whitespace-nowrap"
                >
                  Employee
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Project
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 font-medium whitespace-nowrap"
                >
                  Assigned IT Staff
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 font-medium whitespace-nowrap"
                >
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Progress
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 font-medium whitespace-nowrap"
                >
                  Deadline
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 font-medium whitespace-nowrap"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-sm text-[#5c6b7a]"
                  >
                    {projectRows.length === 0
                      ? "No projects yet. Use Add project to create the first one."
                      : "Nothing matches this status."}
                  </td>
                </tr>
              ) : null}
              {visibleRows.map((project) => (
                <tr
                  key={project.id}
                  className="group border-t border-[#e6edf3] text-[#193956]"
                >
                  <td className="sticky left-0 bg-white px-5 py-3.5 whitespace-nowrap group-hover:bg-[#f7fafc]">
                    {project.name}
                  </td>
                  <td className="px-5 py-3.5 font-medium group-hover:bg-[#f7fafc]">
                    {project.projectName}
                  </td>
                  <td className="px-5 py-3.5 group-hover:bg-[#f7fafc]">
                    <div className="relative min-w-52">
                      <button
                        type="button"
                        aria-haspopup="listbox"
                        disabled={!canEdit(project)}
                        aria-expanded={openAssign === project.id}
                        onClick={() =>
                          setOpenAssign((current) =>
                            current === project.id
                              ? null
                              : project.id,
                          )
                        }
                        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[#d7e0ea] bg-white px-3 text-left text-xs text-[#193956]"
                      >
                        <span className="truncate">
                          {(assignedBy[project.id] ?? []).length > 0
                            ? assignedBy[project.id].join(", ")
                            : "Select IT staff"}
                        </span>
                        <span aria-hidden="true" className="text-[#8aa0b3]">
                          ▾
                        </span>
                      </button>
                      {openAssign === project.id ? (
                        <ul
                          role="listbox"
                          aria-label={`Assigned IT staff for ${project.projectName}`}
                          aria-multiselectable="true"
                          className="absolute z-20 mt-1 w-full rounded-md border border-[#d7e0ea] bg-white py-1 shadow-lg"
                        >
                          {itStaff.map((person) => {
                            const selected = (
                              assignedBy[project.id] ?? []
                            ).includes(person.name);
                            return (
                              <li key={person.name} role="option" aria-selected={selected}>
                                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-[#f5f7fa]">
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() =>
                                      toggleDeveloper(
                                        project.id,
                                        person.name,
                                      )
                                    }
                                    className="accent-[#1d4e89]"
                                  />
                                  <span>
                                    <span className="block font-medium text-[#193956]">
                                      {person.name}
                                    </span>
                                    <span className="block text-[#5c6b7a]">
                                      {person.title}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap group-hover:bg-[#f7fafc]">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[statuses[project.id]]}`}
                    >
                      {statuses[project.id]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 group-hover:bg-[#f7fafc]">
                    <div className="flex min-w-36 items-center gap-3">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6edf3]"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded-full bg-[#1d4e89]"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-xs font-medium text-[#5c6b7a] tabular-nums">
                        {project.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-[#5c6b7a] group-hover:bg-[#f7fafc]">
                    <time dateTime={project.deadline}>
                      {deadlineFormat.format(new Date(project.deadline))}
                    </time>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap group-hover:bg-[#f7fafc]">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelected(project)}
                        className="text-xs font-medium text-[#1d4e89] underline decoration-[#1d4e89]/30 underline-offset-2 hover:decoration-[#1d4e89]"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        hidden={!canEdit(project)}
                        onClick={() => openEdit(project)}
                        className="text-xs font-medium text-[#1d4e89] underline decoration-[#1d4e89]/30 underline-offset-2 hover:decoration-[#1d4e89]"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  {statuses[selected.id]} · Due {deadlineFormat.format(new Date(selected.deadline))}
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
            <div className="flex flex-col gap-5 px-6 py-5">
              <div>
                <p className="text-xs font-medium text-[#5c6b7a]">Website</p>
                {selected.projectLink ? (
                  <a
                    href={selected.projectLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 block break-all text-sm text-[#1d4e89] underline decoration-[#1d4e89]/30 underline-offset-4 hover:decoration-[#1d4e89]"
                  >
                    {selected.projectLink}
                  </a>
                ) : (
                  <p className="mt-1.5 text-sm text-[#8aa0b3]">No website yet.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-[#5c6b7a]">Trello</p>
                {selected.trelloLink ? (
                  <a
                    href={selected.trelloLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 block break-all text-sm text-[#1d4e89] underline decoration-[#1d4e89]/30 underline-offset-4 hover:decoration-[#1d4e89]"
                  >
                    {selected.trelloLink}
                  </a>
                ) : (
                  <p className="mt-1.5 text-sm text-[#8aa0b3]">No Trello board yet.</p>
                )}
              </div>
              <div className="rounded-xl bg-[#f4f7fb] px-4 py-3">
                <p className="text-xs font-medium text-[#5c6b7a]">Notes</p>
                <p className="mt-1.5 text-sm leading-6 whitespace-pre-wrap text-[#193956]">
                  {selected.notes || "No notes yet."}
                </p>
              </div>
            </div>
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
                <p className="text-sm text-[#5c6b7a]">No notifications yet.</p>
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
        onClick={() => setAdding(true)}
        aria-label="Add project"
        className="fixed right-7 bottom-7 z-40 flex h-12 items-center gap-2 rounded-full bg-[#193956] px-5 text-sm font-medium text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#385875]"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          +
        </span>
        Add project
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
            <header className="flex items-center justify-between border-b border-[#e6edf3] px-5 py-4">
              <h2
                id="edit-project-title"
                className="text-lg font-semibold text-[#193956]"
              >
                Edit project
              </h2>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-md px-2 py-1 text-sm text-[#5c6b7a] hover:bg-[#f5f7fa] hover:text-[#193956]"
              >
                Close
              </button>
            </header>
            <ProjectFields form={editForm} onChange={setEditForm} includeLinks staff={itStaff} />
            <div className="flex justify-end border-t border-[#e6edf3] px-5 py-4">
              <button
                type="submit"
                className="rounded-md bg-[#193956] px-4 py-2 text-sm font-medium text-white hover:bg-[#385875]"
              >
                Save
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
                Add project
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
            <div className="flex justify-end border-t border-[#e6edf3] px-5 py-4">
              <button
                type="submit"
                className="rounded-md bg-[#193956] px-4 py-2 text-sm font-medium text-white hover:bg-[#385875]"
              >
                Add project
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      </AnimatePresence>
    </div>
  );
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
          Employee
          <select
            required
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            className={fieldClass}
          >
            <option value="">Select IT employee</option>
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
        Project
        <input
          required
          value={form.projectName}
          onChange={(event) =>
            onChange({ ...form, projectName: event.target.value })
          }
          className={fieldClass}
        />
      </label>
      <div className="grid gap-1">
        <span className="text-xs font-medium text-[#5c6b7a]">
          Assigned IT Staff
        </span>
        <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={staffOpen}
            onClick={() => setStaffOpen((open) => !open)}
            className="flex h-9 w-full items-center justify-between rounded-md border border-[#d7e0ea] bg-white px-3 text-left text-sm text-[#193956]"
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
        Progress
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
          placeholder="Add a note"
          className="rounded-lg border border-[#d7e0ea] px-3 py-2.5 text-sm leading-6 text-[#193956] outline-none transition focus:border-[#1d4e89] focus:ring-2 focus:ring-[#1d4e89]/15"
        />
      </label>
      {includeLinks ? (
        <>
          <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
            Website
            <input
              type="url"
              value={form.projectLink}
              onChange={(event) =>
                onChange({ ...form, projectLink: event.target.value })
              }
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
            Trello
            <input
              type="url"
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

