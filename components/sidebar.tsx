import Link from "next/link";

export default function Sidebar() {
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

      <nav className="px-3 py-4" aria-label="Main">
        <Link
          href="/"
          aria-current="page"
          className="relative flex items-center gap-3 overflow-hidden rounded-lg bg-[#385875] py-2.5 pr-3 pl-4 text-sm font-medium text-[#F5F7FA] transition-colors hover:bg-[#446586]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px] bg-[#F0B429]"
          />
          <GaugeIcon />
          Dashboard
        </Link>
      </nav>

      <div className="mt-auto border-t border-[rgba(255,255,255,0.12)] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d7dee6] text-[#6d7c8c]">
            <PersonIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-wide text-[#F5F7FA] uppercase">
              Arley Flores
            </p>
            <p className="truncate text-xs text-[#AFC0D0]">IT Officer</p>
          </div>
          <button
            type="button"
            aria-label="Log out"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#F5F7FA] transition-colors hover:bg-white/10"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

function GaugeIcon() {
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
      <path d="M4.75 15.25a7.25 7.25 0 1 1 14.5 0" />
      <path d="M12 15.25 16.1 10.2" />
      <circle cx="12" cy="15.25" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
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

function LogoutIcon() {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
