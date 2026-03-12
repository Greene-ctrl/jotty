"use server";

import { USERS_FILE, NOTES_DIR, CHECKLISTS_DIR } from "@/app/_consts/files";
import { readJsonFile } from "../file/json";
import { Result, ItemType, User } from "@/app/_types";
import fs from "fs/promises";
import path from "path";
import { ItemTypes, Modes } from "@/app/_types/enums";
import { capitalize } from "lodash";
import { logAudit } from "@/app/_server/actions/log";

export const findFileRecursively = async (
  dir: string,
  targetFileName: string,
  targetCategory: string
): Promise<string | null> => {
  try {
    const categoryParts = targetCategory.split("/");
    const currentCategoryPart = categoryParts[0];
    const remainingCategoryParts = categoryParts.slice(1);

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        if (entry.name === currentCategoryPart) {
          if (remainingCategoryParts.length === 0) {
            const categoryPath = path.join(dir, entry.name);
            const categoryEntries = await fs.readdir(categoryPath, {
              withFileTypes: true,
            });

            for (const fileEntry of categoryEntries) {
              if (fileEntry.isFile() && fileEntry.name === targetFileName) {
                return path.join(categoryPath, fileEntry.name);
              }
            }
          } else {
            const result = await findFileRecursively(
              path.join(dir, entry.name),
              targetFileName,
              remainingCategoryParts.join("/")
            );
            if (result) return result;
          }
        } else {
          const result = await findFileRecursively(
            path.join(dir, entry.name),
            targetFileName,
            targetCategory
          );
          if (result) return result;
        }
      }
    }
  } catch (error) {
    return null;
  }

  return null;
};

export const getUserIndex = async (username: string): Promise<number> => {
  const allUsers = await readJsonFile(USERS_FILE);
  if (!allUsers || !Array.isArray(allUsers)) return -1;
  return allUsers.findIndex((user: User) => user.username === username);
};

export const getUserByItem = async (
  itemID: string,
  itemCategory: string,
  itemType: ItemType
): Promise<Result<User>> => {
  try {
    const baseDir = path.join(
      process.cwd(),
      "data",
      itemType === ItemTypes.CHECKLIST ? Modes.CHECKLISTS : Modes.NOTES
    );
    const targetFileName = `${itemID}.md`;
    const foundFile = await findFileRecursively(
      baseDir,
      targetFileName,
      itemCategory
    );

    if (!foundFile) {
      return {
        success: false,
        error: `${itemType === ItemTypes.CHECKLIST
          ? capitalize(ItemTypes.CHECKLIST)
          : capitalize(ItemTypes.NOTE)
          } not found`,
      };
    }

    const pathParts = foundFile.split(path.sep);
    const typeIndex = pathParts.indexOf(
      itemType === ItemTypes.CHECKLIST ? Modes.CHECKLISTS : Modes.NOTES
    );
    const username = pathParts[typeIndex + 1];

    const { getUserByUsername } = await import("./queries");
    const foundUser = await getUserByUsername(username);

    if (!foundUser) {
      return { success: false, error: "Invalid user" };
    }

    return { success: true, data: foundUser };
  } catch (error) {
    console.error(`Error in getUserBy${itemType}:`, error);
    return { success: false, error: `Failed to find ${itemType} owner` };
  }
};

const findUuidInDirectory = async (
  dir: string,
  targetUuid: string
): Promise<boolean> => {
  try {
    const { spawn } = await import("child_process");

    return new Promise((resolve) => {
      const grep = spawn("grep", ["-rl", `uuid: ${targetUuid}`, dir, "--include=*.md"]);
      let output = "";

      grep.stdout.on("data", (data) => {
        output += data.toString();
      });

      grep.on("close", () => {
        resolve(output.trim().length > 0);
      });

      grep.on("error", () => {
        resolve(false);
      });
    });
  } catch (error) {
    return false;
  }
};

export const getUserByItemUuid = async (
  uuid: string,
  itemType: ItemType
): Promise<Result<User>> => {
  try {
    const users = (await readJsonFile(USERS_FILE)) || [];

    // In auto-login mode, users might be empty
    if (!Array.isArray(users) || users.length === 0) {
       return { success: false, error: "No users found" };
    }

    for (const user of users) {
      try {
        const userDir =
          itemType === ItemTypes.NOTE
            ? NOTES_DIR(user.username)
            : CHECKLISTS_DIR(user.username);

        const found = await findUuidInDirectory(userDir, uuid);
        if (found) {
          return { success: true, data: user };
        }
      } catch (error) {
        await logAudit({
          level: "DEBUG",
          action: "user_item_check",
          category: "user",
          success: false,
          errorMessage: `Error checking items for user: ${user.username}`,
          metadata: { error: String(error) }
        });
        continue;
      }
    }

    return {
      success: false,
      error: `${itemType === ItemTypes.NOTE
        ? capitalize(ItemTypes.NOTE)
        : capitalize(ItemTypes.CHECKLIST)
        } not found`,
    };
  } catch (error) {
    console.error(`Error in getUserBy${itemType}Uuid:`, error);
    return { success: false, error: `Failed to find ${itemType} owner` };
  }
};
