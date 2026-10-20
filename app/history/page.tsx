import { Suspense } from "react";
import HistoryPage from "@/app/pages/historypage";
import { requireSession } from "@/lib/sso/session.ts";

async function GuardedHistory() {
  await requireSession();
  return <HistoryPage />;
}

export default function History() {
  return (
    <Suspense fallback={null}>
      <GuardedHistory />
    </Suspense>
  );
}
