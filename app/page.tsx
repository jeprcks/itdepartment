import { Suspense } from "react";
import Homepage from "@/app/pages/homepage";
import { requireSession } from "@/lib/sso/session.ts";

async function Dashboard() {
  const session = await requireSession();
  return (
    <Homepage
      viewer={{ name: session.name, access: session.access, position: session.position }}
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
