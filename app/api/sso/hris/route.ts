import {
  consumeHrisToken,
  issueSessionCookie,
  readHandshakeConfig,
  readSessionSeconds,
  readSessionSecret,
  resolveAccess,
  safeNextPath,
} from "../../../../lib/sso/handshake.ts";

export async function POST(request: Request) {
  const config = readHandshakeConfig();
  const sessionSecret = readSessionSecret();
  if (!config || !sessionSecret) {
    return Response.json({ error: "Authentication failed" }, { status: 401 });
  }

  let token = "";
  let next = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { token?: unknown; next?: unknown } | null;
    token = typeof body?.token === "string" ? body.token : "";
    next = typeof body?.next === "string" ? body.next : "";
  } else {
    const form = await request.formData().catch(() => null);
    token = String(form?.get("token") ?? "");
    next = String(form?.get("next") ?? "");
  }

  const result = await consumeHrisToken(token, config);
  if (!result.ok) {
    console.info("hris sso rejected", { reason: result.reason });
    return Response.json({ error: "Authentication failed" }, { status: 401 });
  }

  const access = resolveAccess(result.claims);
  if (!access) {
    console.info("hris sso denied", { reason: "not-it-department", uid: result.claims.hrmsUserId });
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/access-denied",
        "Set-Cookie": `it_pm_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`,
        "Cache-Control": "no-store",
      },
    });
  }

  const cookie = issueSessionCookie(
    sessionSecret,
    result.claims,
    access,
    Math.floor(Date.now() / 1000),
    process.env.NODE_ENV === "production",
    readSessionSeconds(),
  );
  const destination = safeNextPath(next, config.allowedPaths);
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination,
      "Set-Cookie": serializeCookie(cookie),
      "Cache-Control": "no-store",
    },
  });
}

function serializeCookie(cookie: {
  name: string;
  value: string;
  secure: boolean;
  path: string;
  maxAge: number;
}) {
  const parts = [
    `${cookie.name}=${cookie.value}`,
    `Max-Age=${cookie.maxAge}`,
    `Path=${cookie.path}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (cookie.secure) parts.push("Secure");
  return parts.join("; ");
}
