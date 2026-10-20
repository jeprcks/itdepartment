"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard", icon: "bi-speedometer2" },
  { href: "/logs", label: "Logs", icon: "bi-journal-text" },
];

export default function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col px-0 py-2" aria-label="Main">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative mx-2.5 my-px flex items-center gap-[11px] rounded-lg px-2.5 py-2 text-[0.835rem] ${
              active
                ? "bg-white/[0.14] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                : "font-medium text-white/80 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            {active ? (
              <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-[#c9973a]" />
            ) : null}
            <i className={`bi ${item.icon} w-5 text-center text-base ${active ? "text-[#f3d9a6]" : "opacity-90"}`} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
