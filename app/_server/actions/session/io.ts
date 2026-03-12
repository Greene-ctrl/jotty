"use server";

import { cookies } from "next/headers";
import { readJsonFile, writeJsonFile } from "../file/json";
import { SESSION_DATA_FILE, SESSIONS_FILE } from "@/app/_consts/files";
import { isEnvEnabled } from "@/app/_utils/env-utils";

export interface SessionData {
  id: string;
  username: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  lastActivity: string;
  loginType?: "local" | "sso" | "pending-mfa";
}

export interface Session {
  [key: string]: string;
}

export const readSessionData = async (): Promise<
  Record<string, SessionData>
> => {
  const data = await readJsonFile(SESSION_DATA_FILE);
  return data || {};
};

export const writeSessionData = async (
  sessions: Record<string, SessionData>,
): Promise<void> => {
  await writeJsonFile(sessions, SESSION_DATA_FILE);
};

export const writeSessions = async (sessions: Session): Promise<void> => {
  await writeJsonFile(sessions, SESSIONS_FILE);
};

export const readSessions = async (): Promise<Session> => {
  const data = await readJsonFile(SESSIONS_FILE);
  return data || {};
};

export const getSessionId = async (): Promise<string> => {
  const cookieName =
    process.env.NODE_ENV === "production" && isEnvEnabled(process.env.HTTPS)
      ? "__Host-session"
      : "session";
  try {
    const c = await cookies();
    return c.get(cookieName)?.value || "";
  } catch (e) {
    return "";
  }
};
