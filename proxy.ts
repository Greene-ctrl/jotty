import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isEnvEnabled, isDebugFlag } from "./app/_utils/env-utils";

const debugProxy = isDebugFlag("proxy");

export const proxy = async (request: NextRequest) => {
  const { pathname, searchParams } = request.nextUrl;

  // Allow public assets and auth paths (though we might remove auth later)
  if (
    pathname.startsWith("/api/auth/check-session") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/public/")
  ) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  // Token-based authentication check
  const authToken = request.headers.get("x-auth-token") || searchParams.get("token");
  const expectedToken = process.env.APP_AUTH_TOKEN;
  const isTokenValid = authToken && expectedToken && authToken === expectedToken;

  if (isTokenValid) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    response.headers.set("x-auth-token", authToken);
    return response;
  }

  // Fallback to session-based authentication
  const cookieName =
    process.env.NODE_ENV === "production" && isEnvEnabled(process.env.HTTPS)
      ? "__Host-session"
      : "session";
  const sessionId = request.cookies.get(cookieName)?.value;

  if (debugProxy) {
    console.log(
      "MIDDLEWARE - session cookie:",
      sessionId ? "present" : "absent",
    );
  }

  const appUrlBase = process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, "")
    : request.nextUrl.origin;

  // If no session and no valid token, redirect to login for now
  // (We can change this to 401 if we want to fully "remove" login UI)
  if (!sessionId) {
    const loginUrl = new URL(`${appUrlBase}/auth/login`);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const internalApiUrl =
      process.env.INTERNAL_API_URL ||
      (process.env.APP_URL ? new URL(process.env.APP_URL).origin : null) ||
      "http://localhost:3000"; // Default to localhost for HF internal calls

    const sessionCheckUrl = new URL(`${internalApiUrl}/api/auth/check-session`);

    const sessionCheck = await fetch(sessionCheckUrl, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      },
      cache: "no-store",
    });

    if (!sessionCheck.ok) {
      const loginUrl = new URL(`${appUrlBase}/auth/login`);
      const redirectResponse = NextResponse.redirect(loginUrl);
      redirectResponse.cookies.delete(cookieName);
      return redirectResponse;
    }
  } catch (error) {
    console.error("Session check error:", error);
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|site.webmanifest|sw.js|app-icons).*)",
  ],
};
