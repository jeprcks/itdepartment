import type { ReactNode } from "react";

/** Shared layout classes so every page uses the same width, padding, and overflow rules. */
export const PAGE_SHELL_CLASS =
  "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f4f7fb] px-4 pt-14 pb-4 font-sans sm:px-6 md:px-7 md:py-6";

export const TABLE_SCROLL_CLASS = "min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto";

export const TABLE_CLASS = "w-full border-collapse text-left text-sm";

export const TOOLBAR_CLASS =
  "flex shrink-0 flex-wrap items-center gap-3 border-b border-[#e6edf3] px-3 py-3 sm:px-5 sm:py-4";

export const FILTER_ROW_CLASS =
  "flex shrink-0 flex-wrap items-end gap-3 border-b border-[#e6edf3] bg-[#fbfcfe] px-3 py-3 sm:px-5";

export const FILTER_FIELD_CLASS =
  "h-9 w-full min-w-0 rounded-lg border border-[#d7e0ea] bg-[#f8fafc] px-2.5 text-xs text-[#193956] outline-none transition focus:border-[#1d4e89] focus:bg-white focus:ring-2 focus:ring-[#1d4e89]/15 sm:w-auto";

export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${PAGE_SHELL_CLASS} ${className}`.trim()}>{children}</div>;
}
