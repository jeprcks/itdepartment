"use client";

import { useEffect, useState, type FormEvent } from "react";

type ProjectForm = {
  name: string;
  projectName: string;
  projectLink: string;
  trelloLink: string;
  status: string;
  progress: string;
  deadline: string;
  assignees: string[];
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
};

const projects: Project[] = [
  {
    id: "student-visa-filing",
    name: "Arley Flores",
    projectName: "Student visa filing",
    projectLink: "https://projects.example/student-visa-filing",
    trelloLink: "https://trello.com/b/student-visa-filing",
    status: "In Progress",
    progress: 65,
    deadline: "2026-10-30",
  },
  {
    id: "study-permit-renewal",
    name: "Arley Flores",
    projectName: "Study permit renewal",
    projectLink: "https://projects.example/study-permit-renewal",
    trelloLink: "https://trello.com/b/study-permit-renewal",
    status: "Under Review",
    progress: 90,
    deadline: "2026-11-05",
  },
  {
    id: "document-checklist",
    name: "Arley Flores",
    projectName: "Document checklist",
    projectLink: "https://projects.example/document-checklist",
    trelloLink: "https://trello.com/b/document-checklist",
    status: "Completed",
    progress: 100,
    deadline: "2026-10-12",
  },
  {
    id: "enrollment-confirmation",
    name: "Arley Flores",
    projectName: "Enrollment confirmation",
    projectLink: "https://projects.example/enrollment-confirmation",
    trelloLink: "https://trello.com/b/enrollment-confirmation",
    status: "Not started",
    progress: 0,
    deadline: "2026-12-05",
  },
];

const itStaff = [{ name: "Arley Flores", title: "IT Officer" }];

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

export default function Homepage() {
  const [selected, setSelected] = useState<(typeof projects)[number] | null>(
    null,
  );
  const [assignedBy, setAssignedBy] = useState<Record<string, string[]>>({});
  const [openAssign, setOpenAssign] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      projects.map((project) => [project.id, project.status]),
    ),
  );
  const [projectRows, setProjectRows] = useState(projects);
  const [statusFilter, setStatusFilter] = useState("All");
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<ProjectForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProjectForm>(emptyForm);
  const [notifications, setNotifications] = useState<
    { id: string; message: string; time: string }[]
  >([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  function notify(message: string) {
    setNotifications((current) => [
      {
        id: crypto.randomUUID(),
        message,
        time: new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      },
      ...current,
    ]);
  }

  function notifyAssignmentChange(
    projectLabel: string,
    previous: string[],
    next: string[],
  ) {
    for (const name of next.filter((person) => !previous.includes(person))) {
      notify(`${name} was assigned to ${projectLabel}.`);
    }
    for (const name of previous.filter((person) => !next.includes(person))) {
      notify(`${name} was removed from ${projectLabel}.`);
    }
  }

  function toggleDeveloper(projectId: string, developer: string) {
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
    const name = addForm.name.trim();
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
    };

    setProjectRows((current) => [...current, project]);
    setStatuses((current) => ({ ...current, [project.id]: project.status }));
    setAssignedBy((current) => ({
      ...current,
      [project.id]: addForm.assignees,
    }));
    notify(`${project.projectName} was added.`);
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
    });
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    const projectName = editForm.projectName.trim();
    const name = editForm.name.trim();
    if (!projectName || !name || !editForm.deadline) return;

    const progress = Math.min(100, Math.max(0, Number(editForm.progress) || 0));
    const previous = projectRows.find((project) => project.id === editingId);
    const previousAssignees = assignedBy[editingId] ?? [];
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
      notify(
        `${projectName} status changed to ${editForm.status}.`,
      );
    }
    notifyAssignmentChange(projectName, previousAssignees, editForm.assignees);
    setEditingId(null);
  }

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
    <div className="flex min-h-dvh flex-1 flex-col bg-[#f5f7fa] px-4 pt-4 font-sans sm:px-6 sm:pt-6">
      <div className="mb-3 flex shrink-0 justify-end">
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setNotificationsOpen(true)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#d7e0ea] bg-white text-[#193956] hover:border-[#193956]"
        >
          <BellIcon />
          {notifications.length > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F0B429] px-1 text-[10px] font-semibold text-[#193956]">
              {notifications.length}
            </span>
          ) : null}
        </button>
      </div>
      <div
        className="mb-4 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-5"
        role="group"
        aria-label="Filter by status"
      >
        {summaryCards.map((card) => {
          const active = statusFilter === card.value;
          return (
            <button
              key={card.value}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(card.value)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                active
                  ? "border-[#193956] bg-[#193956] text-white"
                  : "border-[#d7e0ea] bg-white text-[#193956] hover:border-[#385875]"
              }`}
            >
              <span
                className={`block text-xs font-medium ${active ? "text-[#AFC0D0]" : "text-[#5c6b7a]"}`}
              >
                {card.label}
              </span>
              <span className="mt-1 block text-2xl font-semibold tabular-nums">
                {card.count}
              </span>
            </button>
          );
        })}
      </div>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl border border-b-0 border-[#d7e0ea] bg-white">
        <header className="shrink-0 border-b border-[#d7e0ea] px-5 py-4">
          <h1 className="text-lg font-semibold text-[#193956]">
            Project Monitoring
          </h1>
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
                    className="px-5 py-10 text-center text-sm text-[#5c6b7a]"
                  >
                    No projects with this status.
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

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#193956]/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-links-title"
            className="w-full max-w-lg rounded-xl border border-[#d7e0ea] bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#e6edf3] px-5 py-4">
              <div>
                <p className="text-xs font-medium tracking-wide text-[#5c6b7a] uppercase">
                  {selected.name}
                </p>
                <h2
                  id="project-links-title"
                  className="mt-1 text-lg font-semibold text-[#193956]"
                >
                  {selected.projectName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="rounded-md px-2 py-1 text-sm text-[#5c6b7a] transition-colors hover:bg-[#f5f7fa] hover:text-[#193956]"
              >
                Close
              </button>
            </header>
            <div className="flex flex-col gap-4 px-5 py-5">
              <div>
                <p className="text-xs font-medium text-[#5c6b7a]">
                  Project website link
                </p>
                <a
                  href={selected.projectLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-sm text-[#1d4e89] underline decoration-[#1d4e89]/30 underline-offset-2 hover:decoration-[#1d4e89]"
                >
                  {selected.projectLink}
                </a>
              </div>
              <div>
                <p className="text-xs font-medium text-[#5c6b7a]">
                  Project trello link
                </p>
                <a
                  href={selected.trelloLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-sm text-[#1d4e89] underline decoration-[#1d4e89]/30 underline-offset-2 hover:decoration-[#1d4e89]"
                >
                  {selected.trelloLink}
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {notificationsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#193956]/50 p-4"
          onClick={() => setNotificationsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-title"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-[#d7e0ea] bg-white shadow-xl"
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
              {notifications.length === 0 ? (
                <p className="text-sm text-[#5c6b7a]">No notifications yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {notifications.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-[#e6edf3] px-3 py-3"
                    >
                      <p className="text-sm text-[#193956]">{item.message}</p>
                      <p className="mt-1 text-xs text-[#5c6b7a]">{item.time}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setAdding(true)}
        aria-label="Add project"
        className="fixed right-6 bottom-6 z-40 flex h-12 items-center gap-2 rounded-full bg-[#193956] px-5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-[#385875]"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          +
        </span>
        Add
      </button>

      {editingId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#193956]/50 p-4"
          onClick={() => setEditingId(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-title"
            onSubmit={saveEdit}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#d7e0ea] bg-white shadow-xl"
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
            <ProjectFields form={editForm} onChange={setEditForm} includeLinks />
            <div className="flex justify-end border-t border-[#e6edf3] px-5 py-4">
              <button
                type="submit"
                className="rounded-md bg-[#193956] px-4 py-2 text-sm font-medium text-white hover:bg-[#385875]"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {adding ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#193956]/50 p-4"
          onClick={() => setAdding(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-project-title"
            onSubmit={addProject}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#d7e0ea] bg-white shadow-xl"
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
            <ProjectFields form={addForm} onChange={setAddForm} />
            <div className="flex justify-end border-t border-[#e6edf3] px-5 py-4">
              <button
                type="submit"
                className="rounded-md bg-[#193956] px-4 py-2 text-sm font-medium text-white hover:bg-[#385875]"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      ) : null}
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
}: {
  form: ProjectForm;
  onChange: (next: ProjectForm) => void;
  includeLinks?: boolean;
}) {
  const [staffOpen, setStaffOpen] = useState(false);
  const fieldClass =
    "h-9 rounded-md border border-[#d7e0ea] px-3 text-sm text-[#193956] outline-none focus:border-[#1d4e89]";

  return (
    <div className="grid gap-4 px-5 py-5">
      <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
        Employee
        <input
          required
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          className={fieldClass}
        />
      </label>
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
            <span aria-hidden="true" className="text-[#8aa0b3]">
              ▾
            </span>
          </button>
          {staffOpen ? (
            <ul
              role="listbox"
              aria-multiselectable="true"
              className="absolute z-20 mt-1 w-full rounded-md border border-[#d7e0ea] bg-white py-1 shadow-lg"
            >
              {itStaff.map((person) => {
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
      {includeLinks ? (
        <>
          <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
            Project website link
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
            Project trello link
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

