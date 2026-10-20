"use client";

import { useState, type ReactNode } from "react";

export default function SidebarFrame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="sticky top-0 flex h-dvh shrink-0">
      {open ? children : null}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Close sidebar" : "Open sidebar"}
        className="flex h-dvh w-7 items-center justify-center border-r border-[#d7e0ea] bg-[#193956] text-[#F5F7FA] transition hover:bg-[#385875]"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          {open ? "‹" : "›"}
        </span>
      </button>
    </div>
  );
}
