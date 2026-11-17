"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function SidebarFrame({ children }: { children: ReactNode }) {
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener("it-pm-close-sidebar", close);
    return () => window.removeEventListener("it-pm-close-sidebar", close);
  }, []);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-[#0f2540]/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-expanded={mobileOpen}
        aria-label="Open sidebar"
        hidden={mobileOpen}
        className="fixed top-3 left-3 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-[#d7e0ea] bg-[#193956] text-[#F5F7FA] shadow-md md:hidden"
      >
        <i className="bi bi-list text-xl leading-none" aria-hidden="true" />
      </button>

      <div
        className={`h-dvh shrink-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 md:sticky md:top-0 md:z-30 ${
          mobileOpen ? "flex" : "hidden md:flex"
        }`}
      >
        {desktopOpen || mobileOpen ? children : null}
        <button
          type="button"
          onClick={() => (mobileOpen ? setMobileOpen(false) : setDesktopOpen((current) => !current))}
          aria-expanded={mobileOpen || desktopOpen}
          aria-label={desktopOpen || mobileOpen ? "Close sidebar" : "Open sidebar"}
          className="flex h-dvh w-7 items-center justify-center border-r border-[#d7e0ea] bg-[#193956] text-[#F5F7FA] transition hover:bg-[#385875]"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            {desktopOpen || mobileOpen ? "‹" : "›"}
          </span>
        </button>
      </div>
    </>
  );
}
