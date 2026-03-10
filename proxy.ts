import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDebugFlag } from "./app/_utils/env-utils";

const debugProxy = isDebugFlag("proxy");

export const proxy = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  if (debugProxy) {
    console.log("MIDDLEWARE - pathname:", pathname);
  }

  // To remove the login interface, we allow all requests to proceed.
  // The server-side logic in `getCurrentUser` will handle providing
  // an automatic user context.

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|site.webmanifest|sw.js|app-icons).*)",
  ],
};
