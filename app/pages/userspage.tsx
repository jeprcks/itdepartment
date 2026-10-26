"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import Modal from "@/components/modal";
import PageHeader from "@/components/page-header";
import { Pagination, SortHeader, compareValues, nextSort, type SortState } from "@/components/table-controls";
import { APP_ROLES, ROLE_LABELS, type AppRole } from "@/lib/access-rules.ts";
import type { ManagedUser as BaseUser } from "@/lib/user-access.ts";

type ManagedUser = BaseUser & { assignable: AppRole[] };

type SortKey = "employeeNumber" | "name" | "department" | "access" | "status";
type Status = "active" | "disabled" | "none";

const SOURCE_LABELS = { hris: "HRIS default", override: "Admin override", bootstrap: "Protected" } as const;

function statusOf(user: ManagedUser): Status {
  if (!user.enabled) return "disabled";
  return user.access === "none" ? "none" : "active";
}

const STATUS_LABELS: Record<Status, string> = { active: "Active", disabled: "Disabled", none: "No access" };
const STATUS_STYLES: Record<Status, string> = {
  active: "bg-[#e8f5ee] text-[#1e7a46]",
  disabled: "bg-[#fdecec] text-[#9b2c2c]",
  none: "bg-[#eef1f5] text-[#5c6b7a]",
};

const field =
  "h-9 rounded-lg border border-[#d7e0ea] bg-[#f8fafc] px-2.5 text-xs text-[#193956] outline-none transition focus:border-[#1d4e89] focus:bg-white focus:ring-2 focus:ring-[#1d4e89]/15";
const smallBtn = "rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

export default function UsersPage({ me, viewerAccess }: { me: string; viewerAccess: string }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState<{ user: ManagedUser | null; role: AppRole; pick: string } | null>(null);
  const [confirming, setConfirming] = useState<ManagedUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/users", { cache: "no-store" }).catch(() => null);
    const body = response ? ((await response.json().catch(() => ({}))) as { users?: ManagedUser[]; error?: string }) : {};
    if (response?.ok && body.users) {
      setUsers(body.users);
      setLoadError("");
    } else {
      setUsers([]);
      setLoadError(body.error ?? "Could not load users from HRIS.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/users", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: (await response.json().catch(() => ({}))) as { users?: ManagedUser[]; error?: string } }))
      .then(({ ok, body }) => {
        if (!active) return;
        setUsers(ok && body.users ? body.users : []);
        setLoadError(ok ? "" : body.error ?? "Could not load users from HRIS.");
      })
      .catch(() => {
        if (active) {
          setUsers([]);
          setLoadError("Could not load users from HRIS.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const all = useMemo(() => users ?? [], [users]);
  const departments = useMemo(() => [...new Set(all.map((user) => user.department).filter(Boolean))].sort(compareValues), [all]);
  const query = search.trim().toLowerCase();
  const filtered = all.filter((user) => {
    if (query && ![user.employeeNumber, user.name, user.email, user.position, user.hrisRole].some((v) => v.toLowerCase().includes(query))) return false;
    if (department && user.department !== department) return false;
    if (status && statusOf(user) !== status) return false;
    if (role && user.access !== role) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    const pick = (user: ManagedUser) => (sort.key === "status" ? statusOf(user) : sort.key === "access" ? ROLE_LABELS[user.access] : user[sort.key]);
    const result = compareValues(pick(a), pick(b));
    return sort.dir === "asc" ? result : -result;
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const withAccess = all.filter((user) => statusOf(user) === "active").length;
  const activeFilters = Boolean(search || department || status || role);
  const candidates = all.filter((user) => !user.protection && statusOf(user) !== "active");

  const onSort = (key: SortKey) => {
    setSort((current) => nextSort(current, key));
    setPage(1);
  };
  const protectedUser = (user: ManagedUser) =>
    user.protection === "super_admin" ||
    (user.protection === "admin" && viewerAccess !== "super_admin") ||
    user.employeeNumber.toLowerCase() === me.toLowerCase();

  async function save(employeeNumber: string, change: { role?: AppRole; enabled?: boolean }, done: string) {
    setSaving(true);
    setSaveError("");
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeNumber, ...change }),
    }).catch(() => null);
    const body = response ? ((await response.json().catch(() => ({}))) as { error?: string }) : { error: "Network error." };
    setSaving(false);
    if (!response?.ok) {
      setSaveError(body.error ?? "Could not save the change.");
      return false;
    }
    setNotice(done);
    await load();
    return true;
  }

  useEffect(() => {
    if (!editing && !confirming) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEditing(null);
        setConfirming(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editing, confirming]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const editTarget = editing ? editing.user ?? all.find((user) => user.employeeNumber === editing.pick) ?? null : null;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#f4f7fb] px-5 py-5 font-sans sm:px-7 sm:py-6">
      <PageHeader
        title="User Management"
        description="Every employee from HRIS. Decide who can open IT Department Project Management and what role they get. Your decision overrides the HRIS default."
      >
        <button
          type="button"
          onClick={() => {
            setSaveError("");
            setEditing({ user: null, role: "it_staff", pick: "" });
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#193956] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#385875]"
        >
          <i className="bi bi-person-plus" aria-hidden="true" />
          Add user
        </button>
      </PageHeader>

      {notice ? (
        <p role="status" className="mb-3 rounded-lg border border-[#bfe3cd] bg-[#e8f5ee] px-4 py-2 text-sm text-[#1e7a46]">
          {notice}
        </p>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#d7e0ea] bg-white shadow-sm">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#e6edf3] px-5 py-4">
          <div className="mr-auto">
            <h2 className="text-sm font-bold tracking-tight text-[#193956]">Employees</h2>
            <p className="mt-0.5 text-xs text-[#5c6b7a]">
              Showing {filtered.length} of {all.length} employees · {withAccess} with access
            </p>
          </div>
        </header>
        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-[#e6edf3] bg-[#fbfcfe] px-5 py-3" role="search" aria-label="Filter users">
          <label className="grid gap-1 text-[11px] font-medium text-[#5c6b7a]">
            Search
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Name, ID, email or position"
              className={`${field} w-60`}
            />
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-[#5c6b7a]">
            Department
            <select value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }} className={`${field} min-w-40`}>
              <option value="">All departments</option>
              {departments.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-[#5c6b7a]">
            Role
            <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className={`${field} min-w-36`}>
              <option value="">All roles</option>
              {APP_ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-[#5c6b7a]">
            Status
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={`${field} min-w-32`}>
              <option value="">All statuses</option>
              {(Object.keys(STATUS_LABELS) as Status[]).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          {activeFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDepartment("");
                setStatus("");
                setRole("");
                setPage(1);
              }}
              className="h-9 rounded-lg px-3 text-xs font-semibold text-[#9b2c2c] transition hover:bg-[#fdecec]"
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#e6edf3] bg-[#f8fafc] text-[#5c6b7a]">
              <tr>
                <SortHeader label="ID" sortKey="employeeNumber" sort={sort} onSort={onSort} />
                <SortHeader label="Name" sortKey="name" sort={sort} onSort={onSort} />
                <SortHeader label="Department" sortKey="department" sort={sort} onSort={onSort} />
                <th scope="col" className="px-5 py-3 font-medium whitespace-nowrap uppercase">HRIS role</th>
                <SortHeader label="IT Dept role" sortKey="access" sort={sort} onSort={onSort} />
                <th scope="col" className="px-5 py-3 font-medium whitespace-nowrap uppercase">Role source</th>
                <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
                <th scope="col" className="px-5 py-3 text-right font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users === null ? (
                <tr>
                  <td colSpan={8} className="px-5 py-20 text-center text-sm text-[#5c6b7a]">Loading employees from HRIS…</td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-20 text-center text-sm text-[#5c6b7a]">
                    {loadError || (all.length === 0 ? "No employees found in HRIS." : "No employees match these filters.")}
                  </td>
                </tr>
              ) : (
                paged.map((user) => {
                  const state = statusOf(user);
                  const locked = protectedUser(user);
                  return (
                    <tr key={user.employeeNumber} className="border-b border-[#eef2f6] last:border-0 hover:bg-[#f8fbfe]">
                      <td className="px-5 py-3 font-mono text-xs whitespace-nowrap text-[#385875]">{user.employeeNumber}</td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-[#193956] capitalize">{user.name.toLowerCase()}</p>
                        <p className="text-xs text-[#5c6b7a]">{user.email || "—"}</p>
                      </td>
                      <td className="px-5 py-3 text-[#385875]">
                        {user.department || "—"}
                        {user.position ? <span className="block text-xs text-[#5c6b7a]">{user.position}</span> : null}
                      </td>
                      <td className="px-5 py-3 text-[#385875]">{user.hrisRole || "—"}</td>
                      <td className="px-5 py-3 font-medium text-[#193956]">{ROLE_LABELS[user.access]}</td>
                      <td className="px-5 py-3 text-xs text-[#5c6b7a]">
                        {SOURCE_LABELS[user.source]}
                        {user.updatedBy ? <span className="block">by {user.updatedBy}</span> : null}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[state]}`}>{STATUS_LABELS[state]}</span>
                        {!user.hrisActive ? <span className="mt-1 block text-[11px] text-[#9b2c2c]">Inactive in HRIS</span> : null}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={locked}
                            title={locked ? (user.protection === "super_admin" ? "The Super Admin cannot be edited." : user.protection === "admin" ? "Only the Super Admin can change an Admin." : "You cannot change your own access.") : undefined}
                            onClick={() => {
                              setSaveError("");
                              setEditing({ user, role: user.assignable.includes(user.assignedRole) && user.assignedRole !== "none" ? user.assignedRole : user.assignable[0], pick: user.employeeNumber });
                            }}
                            className={`${smallBtn} border-[#bcd0e6] text-[#1d4e89] hover:bg-[#eef3f8]`}
                          >
                            Edit role
                          </button>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => {
                              setSaveError("");
                              setConfirming(user);
                            }}
                            className={
                              user.enabled
                                ? `${smallBtn} border-[#f1c9c9] text-[#9b2c2c] hover:bg-[#fdecec]`
                                : `${smallBtn} border-[#bfe3cd] text-[#1e7a46] hover:bg-[#e8f5ee]`
                            }
                          >
                            {user.enabled ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
        {editing ? (
          <Modal labelledBy="user-edit-title" onClose={() => setEditing(null)} className="w-full max-w-lg rounded-2xl border border-[#d7e0ea] bg-white shadow-2xl">
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!editTarget) {
                  setSaveError("Choose an employee first.");
                  return;
                }
                const ok = await save(
                  editTarget.employeeNumber,
                  { role: editing.role, enabled: true },
                  `${editTarget.name} is now ${ROLE_LABELS[editing.role]}.`,
                );
                if (ok) setEditing(null);
              }}
            >
              <header className="flex items-start justify-between gap-4 border-b border-[#e6edf3] px-5 py-4">
                <div>
                  <p className="text-xs font-medium tracking-wide text-[#5c6b7a] uppercase">{editing.user ? "Edit role" : "Add user"}</p>
                  <h2 id="user-edit-title" className="mt-1 text-lg font-semibold text-[#193956] capitalize">
                    {editTarget ? editTarget.name.toLowerCase() : "Give an employee access"}
                  </h2>
                </div>
                <button type="button" onClick={() => setEditing(null)} className="rounded-md px-2 py-1 text-sm text-[#5c6b7a] hover:bg-[#f5f7fa] hover:text-[#193956]">
                  Close
                </button>
              </header>
              <div className="flex flex-col gap-4 px-5 py-5 text-sm text-[#193956]">
                {!editing.user ? (
                  <label className="grid gap-1 text-xs font-medium text-[#5c6b7a]">
                    Employee (from HRIS, without access)
                    <select value={editing.pick} onChange={(event) => setEditing({ ...editing, pick: event.target.value })} className={`${field} h-10 text-sm`}>
                      <option value="">Choose an employee…</option>
                      {candidates.map((user) => (
                        <option key={user.employeeNumber} value={user.employeeNumber}>
                          {user.name} · {user.employeeNumber}
                          {user.department ? ` · ${user.department}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {editTarget ? (
                  <p className="text-xs text-[#5c6b7a]">
                    {editTarget.employeeNumber} · {editTarget.department || "No department"} · HRIS role: {editTarget.hrisRole || "—"} · HRIS default here:{" "}
                    {ROLE_LABELS[editTarget.hrisDefault]}
                  </p>
                ) : null}
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-xs font-medium text-[#5c6b7a]">Role in IT Department</legend>
                  {(editTarget?.assignable ?? (["president", "it_staff", "viewer", "none"] as AppRole[])).map((value) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                        editing.role === value ? "border-[#1d4e89] bg-[#f1f6fb]" : "border-[#d7e0ea] hover:bg-[#f8fafc]"
                      }`}
                    >
                      <input type="radio" name="role" value={value} checked={editing.role === value} onChange={() => setEditing({ ...editing, role: value })} className="mt-1" />
                      <span>
                        <span className="block font-semibold">{ROLE_LABELS[value]}</span>
                        <span className="block text-xs text-[#5c6b7a]">
                          {value === "admin"
                            ? "Everything, including User Management, except changing the Super Admin."
                            : value === "president"
                              ? "Add, edit, archive and reopen every project."
                              : value === "it_staff"
                                ? "Add projects and edit only the ones they own or are assigned to."
                                : value === "viewer"
                                  ? "Can look at projects, details, activity logs and the archive. Cannot change anything or export."
                                  : "Cannot open IT Department Project Management."}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {saveError ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-xs text-[#9b2c2c]">{saveError}</p> : null}
              </div>
              <footer className="flex justify-end gap-2 border-t border-[#e6edf3] px-5 py-3">
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#385875] hover:bg-[#eef3f8]">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !editTarget} className="rounded-lg bg-[#193956] px-4 py-2 text-sm font-semibold text-white hover:bg-[#385875] disabled:opacity-50">
                  {saving ? "Saving…" : "Save role"}
                </button>
              </footer>
            </form>
          </Modal>
        ) : null}
        {confirming ? (
          <Modal labelledBy="user-confirm-title" onClose={() => setConfirming(null)} className="w-full max-w-md rounded-2xl border border-[#d7e0ea] bg-white shadow-2xl">
            <div className="px-5 py-5 text-sm text-[#193956]">
              <h2 id="user-confirm-title" className="text-lg font-semibold">
                {confirming.enabled ? "Disable access?" : "Enable access?"}
              </h2>
              <p className="mt-2 text-[#5c6b7a]">
                {confirming.enabled
                  ? `${confirming.name} will be signed out of IT Department Project Management within a few seconds and cannot sign in until you enable them again.`
                  : `${confirming.name} will be able to sign in again as ${ROLE_LABELS[confirming.assignedRole]}.`}
              </p>
              {saveError ? <p className="mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-xs text-[#9b2c2c]">{saveError}</p> : null}
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#e6edf3] px-5 py-3">
              <button type="button" onClick={() => setConfirming(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#385875] hover:bg-[#eef3f8]">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const target = confirming;
                  const ok = await save(
                    target.employeeNumber,
                    { enabled: !target.enabled },
                    `${target.name} ${target.enabled ? "can no longer" : "can now"} open IT Department.`,
                  );
                  if (ok) setConfirming(null);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${confirming.enabled ? "bg-[#9b2c2c] hover:bg-[#7f2222]" : "bg-[#1e7a46] hover:bg-[#17613a]"}`}
              >
                {saving ? "Saving…" : confirming.enabled ? "Disable" : "Enable"}
              </button>
            </footer>
          </Modal>
        ) : null}
      </AnimatePresence>
    </div>
  );
}