import { Suspense } from "react";
import HistoryPage from "@/app/pages/historypage";
import { requireSession } from "@/lib/sso/session.ts";

async function GuardedLogs() {
  await requireSession();
  return <HistoryPage />;
}

export default function Logs() {
  return (
    <Suspense fallback={null}>
      <GuardedLogs />
    </Suspense>
  );
}
