import { Suspense } from "react";
import HistoryPage from "@/app/pages/historypage";
import { requireSession } from "@/lib/sso/session.ts";

async function GuardedLogs() {
  const session = await requireSession();
  return <HistoryPage readOnly={session.access === "viewer"} />;
}

export default function Logs() {
  return (
    <Suspense fallback={null}>
      <GuardedLogs />
    </Suspense>
  );
}
