import { Suspense } from "react";
import { connection } from "next/server";
import { hrmsDashboardUrl } from "@/lib/sso/handshake.ts";

async function DeniedContent({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  await connection();
  const { reason } = await searchParams;
  const hrms = hrmsDashboardUrl();
  const signin = reason === "signin";
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-[#f5f7fa] p-6 font-sans">
      <div className="max-w-md rounded-xl border border-[#d7e0ea] bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-[#193956]">
          {signin ? "Please sign in through HRMS" : "Access restricted"}
        </h1>
        <p className="mt-3 text-sm text-[#5c6b7a]">
          {signin
            ? "Your session has ended. Open Project Management again from the HRMS menu."
            : "IT Department Project Management is only available to IT Department staff, the President and system administrators. If you think this is wrong, contact HR or IT."}
        </p>
        {hrms ? (
          <a
            href={hrms}
            className="mt-6 inline-block rounded-md bg-[#193956] px-4 py-2 text-sm font-medium text-white hover:bg-[#385875]"
          >
            Back to HRMS Dashboard
          </a>
        ) : null}
      </div>
    </main>
  );
}

export default function AccessDenied(props: { searchParams: Promise<{ reason?: string }> }) {
  return (
    <Suspense fallback={null}>
      <DeniedContent {...props} />
    </Suspense>
  );
}
