import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../users";

export const redirectGuards = async () => {
  const user = await getCurrentUser();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname");

  // If we have a user (which is now guaranteed by the auto-login logic in getCurrentUser),
  // we just ensure they aren't stuck on auth pages.
  if (user && pathname?.includes("/auth")) {
    redirect("/");
  }
};
