import Link from "next/link";
import { getSession } from "@/lib/sso/session.ts";
import { hrmsDashboardUrl } from "@/lib/sso/handshake.ts";

const ACCESS_LABELS = {
  super_admin: "Super Admin",
  president: "President",
  it_staff: "IT Staff",
} as const;

export default async function Sidebar() {
  const profile = await getSession();
  if (!profile) return null;
  const hrms = hrmsDashboardUrl();
  const subtitle = [profile.position || formatLabel(profile.accountType), ACCESS_LABELS[profile.access]]
    .filter(Boolean)
    .join(" \u00b7 ");
  return (
    <aside className="sticky top-0 flex h-dvh w-[22.5rem] shrink-0 flex-col bg-[#193956] font-sans text-[#F5F7FA]">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-extrabold tracking-tight text-[#1d4e89]">
          WISE
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-[#F5F7FA]">
            WISE Immigration & Study Services
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-tight tracking-[0.06em] text-[#F0B429]">
            IT DEPARTMENT PROJECT MANAGEMENT
          </p>
        </div>
      </div>

      <div className="border-t border-[rgba(255,255,255,0.12)]" />

      <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Main">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg py-2.5 pr-3 pl-4 text-sm font-medium text-[#F5F7FA] transition-colors hover:bg-[#446586]"
        >
          Dashboard
        </Link>
        <Link
          href="/history"
          className="flex items-center gap-3 rounded-lg py-2.5 pr-3 pl-4 text-sm font-medium text-[#F5F7FA] transition-colors hover:bg-[#446586]"
        >
          History
        </Link>
      </nav>

      <div className="mt-auto border-t border-[rgba(255,255,255,0.12)] px-4 py-4">
        {hrms ? (
          <a
            href={hrms}
            className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-[rgba(255,255,255,0.25)] py-2.5 text-sm font-medium text-[#F5F7FA] transition-colors hover:bg-[#446586]"
          >
            <BackIcon />
            Back to HRMS Dashboard
          </a>
        ) : null}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d7dee6] text-[#6d7c8c]">
            <PersonIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-wide text-[#F5F7FA] uppercase">
              {profile.name}
            </p>
            <p className="truncate text-xs text-[#AFC0D0]">{subtitle}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function formatLabel(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function PersonIcon() {
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
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.25c1.35-2.85 3.55-4.25 6.5-4.25s5.15 1.4 6.5 4.25" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
      <path d="M9 12h12" />
    </svg>
  );
}
