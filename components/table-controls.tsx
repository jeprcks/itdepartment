"use client";

export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K; dir: SortDir };

export function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  return current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
}

export function compareValues(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-5 py-3 font-medium whitespace-nowrap ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase transition hover:text-[#193956] ${active ? "text-[#193956]" : ""}`}
      >
        {label}
        <i
          aria-hidden="true"
          className={`bi ${active ? (sort.dir === "asc" ? "bi-caret-up-fill" : "bi-caret-down-fill") : "bi-chevron-expand"} text-[10px] ${active ? "" : "opacity-50"}`}
        />
      </button>
    </th>
  );
}

export const PAGE_SIZES = [10, 25, 50, 100];

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const btn =
    "rounded-md border border-[#d7e0ea] px-2.5 py-1 text-xs font-semibold text-[#385875] transition hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e6edf3] px-5 py-3 text-xs text-[#5c6b7a]">
      <label className="flex items-center gap-2">
        Rows per page
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          className="h-7 rounded-md border border-[#d7e0ea] bg-white px-1.5 text-xs text-[#193956]"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          {first}–{last} of {total}
        </span>
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <span className="tabular-nums">
          Page {page} of {pages}
        </span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
