import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockRedirect, resetAllMocks } from "../setup";

const mockGetCurrentUser = vi.fn();
const mockHeaders = vi.fn();

vi.mock("@/app/_server/actions/users", () => ({
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve({
      get: (name: string) => mockHeaders(name),
    }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { redirectGuards } from "@/app/_server/actions/guards";

describe("Security: Route Guards", () => {
  beforeEach(() => {
    resetAllMocks();
    mockGetCurrentUser.mockResolvedValue(null);
    mockHeaders.mockReturnValue(null);
  });

  describe("redirectGuards", () => {
    it("should NOT redirect unauthenticated users to login (Login interface removed)", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockHeaders.mockImplementation((name: string) => {
        if (name === "x-pathname") return "/dashboard";
        return null;
      });

      await expect(redirectGuards()).resolves.not.toThrow();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should not redirect for /auth paths if no user", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockHeaders.mockImplementation((name: string) => {
        if (name === "x-pathname") return "/auth/login";
        return null;
      });

      await expect(redirectGuards()).resolves.not.toThrow();
    });

    it("should not redirect for /migration paths", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockHeaders.mockImplementation((name: string) => {
        if (name === "x-pathname") return "/migration";
        return null;
      });

      await expect(redirectGuards()).resolves.not.toThrow();
    });

    it("should not redirect for /public paths", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockHeaders.mockImplementation((name: string) => {
        if (name === "x-pathname") return "/public/shared-note";
        return null;
      });

      await expect(redirectGuards()).resolves.not.toThrow();
    });

    it("should redirect authenticated users away from /auth", async () => {
      mockGetCurrentUser.mockResolvedValue({ username: "testuser" });
      mockHeaders.mockImplementation((name: string) => {
        if (name === "x-pathname") return "/auth/login";
        return null;
      });

      await expect(redirectGuards()).rejects.toThrow("REDIRECT:/");
      expect(mockRedirect).toHaveBeenCalledWith("/");
    });

    it("should allow authenticated users to access protected routes", async () => {
      mockGetCurrentUser.mockResolvedValue({ username: "testuser" });
      mockHeaders.mockImplementation((name: string) => {
        if (name === "x-pathname") return "/dashboard";
        return null;
      });

      await expect(redirectGuards()).resolves.not.toThrow();
    });

    it("should allow authenticated users to access notes", async () => {
      mockGetCurrentUser.mockResolvedValue({ username: "testuser" });
      mockHeaders.mockImplementation((name: string) => {
        if (name === "x-pathname") return "/notes/my-note";
        return null;
      });

      await expect(redirectGuards()).resolves.not.toThrow();
    });

    it("should allow authenticated users to access checklists", async () => {
      mockGetCurrentUser.mockResolvedValue({ username: "testuser" });
      mockHeaders.mockImplementation((name: string) => {
        if (name === "x-pathname") return "/checklists/my-list";
        return null;
      });

      await expect(redirectGuards()).resolves.not.toThrow();
    });

    it("should handle missing pathname header by not redirecting", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockHeaders.mockReturnValue(null);

      await expect(redirectGuards()).resolves.not.toThrow();
    });
  });
});
