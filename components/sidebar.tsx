import { getSession } from "@/lib/sso/session.ts";
import { hrmsDashboardUrl } from "@/lib/sso/handshake.ts";
import SidebarNav from "@/components/sidebar-nav";

const ACCESS_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  president: "President",
  it_staff: "IT Staff",
  viewer: "View only",
} as const;

export default async function Sidebar() {
  const profile = await getSession();
  if (!profile) return null;
  const hrms = hrmsDashboardUrl();
  const role = profile.position || formatLabel(profile.accountType);
  const access = ACCESS_LABELS[profile.access];
  // Badge = role in this app (same names as User Management); HRIS position shown under the name.
  const badge = access;
  const subtitle = role.trim() && role.trim().toLowerCase() !== access.toLowerCase() ? `${access} · ${role}` : access;
  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <aside className="flex h-dvh w-[260px] shrink-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#1a3a5c_0%,#16324f_100%)] font-sans text-white shadow-[4px_0_18px_rgba(15,37,64,0.08)]">
      <div className="flex min-h-[68px] shrink-0 items-center gap-2.5 border-b border-white/8 px-3.5 py-3">
        <img
          src="/wise-logo-sidebar.jpg"
          alt="WISE Immigration and Study Services"
          className="h-[38px] w-[38px] shrink-0 rounded-[9px] bg-white object-contain shadow-[0_0_0_2px_rgba(255,255,255,0.12)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[0.74rem] leading-tight font-bold text-white">
            WISE Immigration & Study Services
          </p>
          <span className="mt-1 inline-block rounded-full border border-[#c9973a]/35 bg-[#c9973a]/18 px-2 py-px text-[0.58rem] font-bold tracking-[0.6px] text-[#f3d9a6] uppercase">
            {badge}
          </span>
        </div>
      </div>

      <SidebarNav isSuperAdmin={profile.access === "super_admin" || profile.access === "admin"} />

      <div className="shrink-0 bg-black/12 px-3 py-2.5">
        {hrms ? (
          <a
            href={hrms}
            className="mb-2 flex items-center gap-[11px] rounded-lg px-2.5 py-2 text-[0.835rem] font-medium text-white/80 hover:bg-white/7 hover:text-white"
          >
            <i className="bi bi-arrow-left-circle w-5 text-center text-base opacity-90" />
            <span className="truncate">Back to HRMS Dashboard</span>
          </a>
        ) : null}
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#c9973a] text-xs font-bold text-white shadow-[0_0_0_2px_rgba(255,255,255,0.15)]">
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8rem] font-semibold text-white capitalize">{profile.name.toLowerCase()}</p>
            <p className="truncate text-[0.68rem] text-white/50">{subtitle}</p>
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
