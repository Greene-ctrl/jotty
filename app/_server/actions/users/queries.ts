"use server";

import { USERS_FILE } from "@/app/_consts/files";
import { readJsonFile } from "../file";
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
  // 1. Check for Auth Token (for API access and bypassing login)
  try {
    const headersList = await headers();
    const authToken = headersList.get("x-auth-token");
    const expectedToken = process.env.APP_AUTH_TOKEN;

    if (authToken && expectedToken && authToken === expectedToken) {
      const allUsers = await readJsonFile(USERS_FILE);
      if (allUsers && Array.isArray(allUsers)) {
        // Return the super admin or the first admin found
        const adminUser = allUsers.find((u: any) => u.isSuperAdmin) || allUsers.find((u: any) => u.isAdmin);
        if (adminUser) return adminUser;
      }
    }
  } catch (e) {
    // Headers might not be available in all contexts
  }

  // 2. Check for traditional session
  const sessionId = await getSessionId();
  const sessions = await readSessions();
  const currentUsername = sessions[sessionId || ""];

  if (!currentUsername && !username) return null;

  return (await getUserByUsername(currentUsername || username || "")) || null;
};

export const hasUsers = async (): Promise<boolean> => {
  try {
    const users = await readJsonFile(USERS_FILE);
    return users && users.length > 0;
  } catch (error) {
    return false;
  }
};

export const getUsername = async (): Promise<string> => {
  const user = await getCurrentUser();
  return user?.username || "";
};

export const getUsers = async () => {
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
};

export const getUserByNoteUuid = async (
  uuid: string
): Promise<Result<User>> => {
  return getUserByItemUuid(uuid, ItemTypes.NOTE);
};

export const getUserByChecklistUuid = async (
  uuid: string
): Promise<Result<User>> => {
  return getUserByItemUuid(uuid, ItemTypes.CHECKLIST);
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
