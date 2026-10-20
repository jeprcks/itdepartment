import { listItStaff } from "@/lib/it-staff.ts";
import { getSession } from "@/lib/sso/session.ts";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  try {
    const staff = await listItStaff();
    return Response.json({ staff });
  } catch {
    return Response.json({ staff: [] });
  }
}
