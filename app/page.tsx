import { Suspense } from "react";
import Homepage from "@/app/pages/homepage";
import { requireSession } from "@/lib/sso/session.ts";
import { hrmsDashboardUrl } from "@/lib/sso/handshake.ts";

async function Dashboard() {
  const session = await requireSession();
  return (
    <Homepage
      viewer={{ name: session.name, access: session.access, position: session.position }}
      hrmsUrl={hrmsDashboardUrl() ?? ""}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}
