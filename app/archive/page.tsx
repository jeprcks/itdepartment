import { Suspense } from "react";
import ArchivePage from "@/app/pages/Archivepage";
import { requireSession } from "@/lib/sso/session.ts";

async function GuardedArchive() {
  const session = await requireSession();
  return <ArchivePage viewerName={session.name} readOnly={session.access === "viewer"} />;
}

export default function Archive() {
  return (
    <Suspense fallback={null}>
      <GuardedArchive />
    </Suspense>
  );
}
