import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  hrmsDashboardUrl,
  readSessionProfile,
  readSessionSecret,
} from "./lib/sso/handshake.ts";

const PUBLIC_PATHS = new Set(["/api/sso/hris", "/access-denied"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const profile = readSessionProfile(
    request.cookies.get(SESSION_COOKIE)?.value,
    readSessionSecret(),
  );
  if (profile) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const hrms = hrmsDashboardUrl();
  const target = hrms !== "" ? hrms : new URL("/access-denied?reason=signin", request.url).toString();
  const response = NextResponse.redirect(target, 303);
  if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|css|js)$).*)"],
};
