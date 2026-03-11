"use server";

import { USERS_FILE } from "@/app/_consts/files";
import { readJsonFile } from "../file/json";
import { Result, User } from "@/app/_types";
import { getSessionId, readSessions } from "../session";
import { ItemTypes } from "@/app/_types/enums";
import { getUserByItem, getUserByItemUuid } from "./helpers";
import { headers } from "next/headers";

export const getUserByUsername = async (
  username: string
): Promise<User | null> => {
  const allUsers = await readJsonFile(USERS_FILE);
  if (!allUsers || !Array.isArray(allUsers)) return null;
  return allUsers.find((user: User) => user.username === username) || null;
};

export const getCurrentUser = async (
  username?: string
): Promise<User | null> => {
  // 1. Check for specialized environment flag for testing or emergency
  if (process.env.AUTO_LOGIN === "true") {
      return {
        username: "admin",
        isAdmin: true,
        isSuperAdmin: true,
        fileRenameMode: "minimal",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        preferredDateFormat: "dd/mm/yyyy",
        preferredTimeFormat: "12-hours",
        handedness: "right-handed",
      } as User;
  }

  // 2. Check for Auth Token (for API access and bypassing login)
  try {
    const headersList = await headers();
    const authToken = headersList.get("x-auth-token");
    const expectedToken = process.env.APP_AUTH_TOKEN;

    if (authToken && expectedToken && authToken === expectedToken) {
      const allUsers = await readJsonFile(USERS_FILE);
      if (allUsers && Array.isArray(allUsers)) {
        const adminUser = allUsers.find((u: any) => u.isSuperAdmin) || allUsers.find((u: any) => u.isAdmin);
        if (adminUser) return adminUser;
      }
    }
  } catch (e) {}

  // 3. Check for traditional session
  try {
    const sessionId = await getSessionId();
    const sessions = await readSessions();
    const currentUsername = sessions[sessionId || ""];

    if (currentUsername) {
      const user = await getUserByUsername(currentUsername);
      if (user) return user;
    }
  } catch (e) {}

  // 4. AUTO-LOGIN / FALLBACK: Return an admin user to bypass the login requirement.
  try {
    const allUsers = await readJsonFile(USERS_FILE);
    if (allUsers && Array.isArray(allUsers) && allUsers.length > 0) {
      const fallback = allUsers.find((u: any) => u.isSuperAdmin) ||
                       allUsers.find((u: any) => u.isAdmin) ||
                       allUsers[0];
      if (fallback) return fallback;
    }
  } catch (e) {}

  // 5. EMERGENCY FALLBACK: If no users exist yet, return a default admin.
  return {
    username: "admin",
    isAdmin: true,
    isSuperAdmin: true,
    fileRenameMode: "minimal",
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    preferredDateFormat: "dd/mm/yyyy",
    preferredTimeFormat: "12-hours",
    handedness: "right-handed",
  } as User;
};

export const hasUsers = async (): Promise<boolean> => {
  try {
    const users = await readJsonFile(USERS_FILE);
    return users && Array.isArray(users) && users.length > 0;
  } catch (error) {
    return false;
  }
};

export const getUsername = async (): Promise<string> => {
  const user = await getCurrentUser();
  return user?.username || "";
};

export const getUsers = async () => {
  try {
    const users = (await readJsonFile(USERS_FILE)) || [];

    if (!users || !Array.isArray(users)) {
      return [];
    }

    return users.map(({ username, isAdmin, isSuperAdmin, avatarUrl }: User) => ({
      username,
      isAdmin,
      isSuperAdmin,
      avatarUrl,
    }));
  } catch (error) {
    return [];
  }
};

export const getUserByNoteUuid = async (
  uuid: string
): Promise<Result<User>> => {
  try {
    return await getUserByItemUuid(uuid, ItemTypes.NOTE);
  } catch (error) {
    return { success: false, error: "Failed to find note owner" };
  }
};

export const getUserByChecklistUuid = async (
  uuid: string
): Promise<Result<User>> => {
  try {
    return await getUserByItemUuid(uuid, ItemTypes.CHECKLIST);
  } catch (error) {
    return { success: false, error: "Failed to find checklist owner" };
  }
};

export const getUserByChecklist = async (
  checklistID: string,
  checklistCategory: string
): Promise<Result<User>> => {
  return getUserByItem(checklistID, checklistCategory, ItemTypes.CHECKLIST);
};

export const getUserByNote = async (
  noteID: string,
  noteCategory: string
): Promise<Result<User>> => {
  return getUserByItem(noteID, noteCategory, ItemTypes.NOTE);
};
