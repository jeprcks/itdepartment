import { csvResponse, toCsv } from "@/lib/csv.ts";
import { listArchivedProjects, listProjects } from "@/lib/projects.ts";
import { getSession } from "@/lib/sso/session.ts";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  const projects = archived ? await listArchivedProjects() : await listProjects();
  const csv = toCsv(
    ["Project", "Owner", "Assigned IT staff", "Status", "Progress (%)", "Deadline", "Website", "Trello", "Notes"],
    projects.map((p) => [p.projectName, p.name, p.assignees.join("; "), p.status, p.progress, p.deadline, p.projectLink, p.trelloLink, p.notes]),
  );
  const day = new Date().toISOString().slice(0, 10);
  return csvResponse(`it-projects${archived ? "-archived" : ""}-${day}.csv`, csv);
}
