import { Suspense } from "react";
import UsersPage from "@/app/pages/userspage";
import { requireUserManager } from "@/lib/sso/session.ts";

async function GuardedUsers() {
  const session = await requireUserManager();
  return <UsersPage me={session.sub} viewerAccess={session.access} />;
}

export default function Users() {
  return (
    <Suspense fallback={null}>
      <GuardedUsers />
    </Suspense>
  );
}