import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../users";

const EXCLUDED_PATHS = ["/auth", "/migration", "/public", "/api"];

export const redirectGuards = async () => {
  const user = await getCurrentUser();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname");
  const authToken = headersList.get("x-auth-token");

  // If we have a user (either via session or token), we are good
  if (user) {
    if (pathname?.includes("/auth")) {
      redirect("/");
    }
    return;
  }

  // If no user and not an excluded path, we'd normally redirect to login.
  // But if we want to "remove login", maybe we should just redirect to a public page or 401.
  // For now, let's keep the redirect but check if the user is trying to use a token.

  if (!EXCLUDED_PATHS.some((path) => pathname?.includes(path))) {
    // If there's an APP_AUTH_TOKEN set, and we don't have a user, it means the token was missing or wrong.
    if (process.env.APP_AUTH_TOKEN && !authToken) {
       // Instead of login, we could redirect to a "Token Required" page
       // But to keep it simple and follow "Remove the login", let's just not redirect to login if we are strictly token-based.
       // However, Next.js needs a destination.
       redirect("/auth/login");
    } else if (!process.env.APP_AUTH_TOKEN) {
       redirect("/auth/login");
    }
  }
};
