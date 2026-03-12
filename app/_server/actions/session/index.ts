"use server";

import fs from "fs/promises";
import { cookies, headers } from "next/headers";
import { Result } from "@/app/_types";
import { SESSION_DATA_FILE, SESSIONS_FILE } from "@/app/_consts/files";
import { getCurrentUser } from "../users";
import { logAuthEvent } from "@/app/_server/actions/log";
import { isEnvEnabled } from "@/app/_utils/env-utils";
import {
  readSessionData as rSD,
  writeSessionData as wSD,
  readSessions as rS,
  writeSessions as wS,
  getSessionId as gSID,
  type SessionData as SD,
  type Session as S
} from "./io";

export type SessionData = SD;
export type Session = S;

export const readSessionData = rSD;
export const writeSessionData = wSD;
export const readSessions = rS;
export const writeSessions = wS;
export const getSessionId = gSID;

export const createSession = async (
  sessionId: string,
  username: string,
  loginType: "local" | "sso" | "pending-mfa",
): Promise<void> => {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "Unknown";
  const forwarded = headersList.get("x-forwarded-for");
  const realIp = headersList.get("x-real-ip");
  const ipAddress = forwarded || realIp || "Unknown";

  const sessionData: SessionData = {
    id: sessionId,
    username,
    userAgent,
    ipAddress,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    loginType,
  };

  const sessionsData = await readSessionData();
  const sessions = await readSessions();
  sessionsData[sessionId] = sessionData;
  sessions[sessionId] = username;
  await writeSessions(sessions);
  await writeSessionData(sessionsData);
};

export const updateSessionActivity = async (
  sessionId: string,
): Promise<void> => {
  const sessionsData = await readSessionData();
  if (sessionsData[sessionId]) {
    sessionsData[sessionId].lastActivity = new Date().toISOString();
    await writeSessionData(sessionsData);
  }
};

export const removeSession = async (sessionId: string): Promise<void> => {
  const sessionsData = await readSessionData();
  const sessions = await readSessions();
  delete sessionsData[sessionId];
  delete sessions[sessionId];
  await writeSessionData(sessionsData);
  await writeSessions(sessions);
};

export const getSessionsForUser = async (
  username: string,
): Promise<SessionData[]> => {
  const sessions = await readSessionData();
  return Object.values(sessions).filter(
    (session) => session.username === username,
  );
};


export const getLoginType = async (): Promise<
  "local" | "sso" | "pending-mfa" | undefined
> => {
  const sessionId = await getSessionId();
  if (!sessionId) return undefined;

  const sessionsData = await readSessionData();
  return sessionsData[sessionId]?.loginType;
};

export const removeAllSessionsForUser = async (
  username: string,
  exceptSessionId?: string,
): Promise<void> => {
  const sessionsData = await readSessionData();
  const sessions = await readSessions();
  const sessionsToRemove = Object.entries(sessionsData)
    .filter(
      ([id, sessionData]) =>
        sessionData.username === username &&
        (!exceptSessionId || id !== exceptSessionId),
    )
    .map(([id]) => id);

  for (const sessionId of sessionsToRemove) {
    delete sessionsData[sessionId];
    delete sessions[sessionId];
  }

  await writeSessionData(sessionsData);
  await writeSessions(sessions);
};

export const clearAllSessions = async (): Promise<Result<null>> => {
  try {
    await fs.writeFile(SESSIONS_FILE, JSON.stringify({}), "utf-8");
    await fs.writeFile(SESSION_DATA_FILE, JSON.stringify({}), "utf-8");

    return { success: true };
  } catch (error) {
    console.error("Error clearing all sessions:", error);
    return {
      success: false,
      error: "Failed to clear all sessions",
    };
  }
};

export const terminateSession = async (
  formData: FormData,
): Promise<Result<null>> => {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    const sessionId = formData.get("sessionId") as string;

    if (!sessionId) {
      return {
        success: false,
        error: "Session ID is required",
      };
    }

    await removeSession(sessionId);

    await logAuthEvent("session_terminated", currentUser.username, true);

    return {
      success: true,
      data: null,
    };
  } catch (error) {
    await logAuthEvent(
      "session_terminated",
      "unknown",
      false,
      "Failed to terminate session",
    );
    console.error("Error terminating session:", error);
    return {
      success: false,
      error: "Failed to terminate session",
    };
  }
};

export const terminateAllOtherSessions = async (): Promise<Result<null>> => {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    const cookieName =
      process.env.NODE_ENV === "production" && isEnvEnabled(process.env.HTTPS)
        ? "__Host-session"
        : "session";
    const sessionId = (await cookies()).get(cookieName)?.value;

    await removeAllSessionsForUser(currentUser.username, sessionId);

    return {
      success: true,
      data: null,
    };
  } catch (error) {
    console.error("Error terminating all other sessions:", error);
    return {
      success: false,
      error: "Failed to terminate sessions",
    };
  }
};
