"use server";

import { getCurrentUser } from "@/app/_server/actions/users/queries";
import {
  DATA_DIR,
  SESSION_DATA_FILE,
  SESSIONS_FILE,
  USERS_DIR,
  USERS_FILE,
} from "@/app/_consts/files";
import fs from "fs/promises";
import path from "path";
import { Modes } from "@/app/_types/enums";

export interface OrderData {
  categories?: string[];
  items?: string[];
}

export const getEnvOrFile = async (
  envVar: string,
  fileVar: string,
): Promise<string> => {
  const filePath = process.env[fileVar];
  if (filePath) {
    try {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      return (await fs.readFile(fullPath, "utf-8")).trim();
    } catch (error) {
      console.error(`Failed to read ${fileVar} from ${filePath}:`, error);
      return "";
    }
  }
  return process.env[envVar] || "";
};

export const ensureCorDirsAndFiles = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  const coreDirAndFiles = {
    dirs: [USERS_DIR],
    files: [USERS_FILE, SESSIONS_FILE, SESSION_DATA_FILE],
  };

  try {
    for (const dir of coreDirAndFiles.dirs) {
      await ensureDir(dir);
    }
    for (const file of coreDirAndFiles.files) {
      await ensureFile(file);
    }
    return { success: true };
  } catch (error) {
    console.error("Error ensuring core dirs and files:", error);
    return { success: false, error: "Failed to ensure core dirs and files" };
  }
};

import {
  readJsonFile as rJF,
  writeJsonFile as wJF,
  ensureDir as eD,
  ensureFile as eF,
} from "./json";

export const readJsonFile = rJF;
export const writeJsonFile = wJF;
export const ensureDir = eD;
export const ensureFile = eF;

export const readFile = async (filePath: string): Promise<string> => {
  try {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(
      fullPath,
      "utf-8",
    );
    return content || "";
  } catch (error) {
    return "";
  }
};

const getCwd = (): Promise<string> => Promise.resolve(process.cwd());

export const getUserModeDir = async (
  mode: Modes,
  username?: string,
): Promise<string> => {
  const base = await getCwd();

  const resolvedDataDir = path.isAbsolute(DATA_DIR)
    ? DATA_DIR
    : path.resolve(base, DATA_DIR);

  if (username) {
    return path.join(resolvedDataDir, mode, username);
  }

  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return path.join(resolvedDataDir, mode, user.username || "");
};

/**
 * @todo figure this out eventually, but for now it's too messy and I want this pull request to go through
 * Basically from client compoennt process.cwd is not available so I have added it to the previou functions.
 * From this comment on it's passed in via filePath/dirPath as these are ONLY called from server components.
 */

export const serverReadFile = async (
  filePath: string,
  customReturn?: any,
): Promise<string> => {
  try {
    return (await fs.readFile(filePath, "utf-8")) || "";
  } catch (error) {
    return customReturn || "";
  }
};

export const serverWriteFile = async (filePath: string, content: string) => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf-8");
};

export const serverDeleteFile = async (filePath: string) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const { logAudit } = await import("@/app/_server/actions/log");
    await logAudit({
      level: "DEBUG",
      action: "file_delete",
      category: "file",
      success: false,
      errorMessage: `File delete failed (may not exist): ${filePath}`,
    });
  }
};

export const serverReadDir = async (dirPath: string) => {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    return [];
  }
};

export const listMdFilesUnderPath = async (
  baseDir: string,
  relativePrefix: string,
): Promise<string[]> => {
  const out: string[] = [];
  const dirPath = path.join(baseDir, relativePrefix);
  let entries: { name: string; isFile: () => boolean; isDirectory: () => boolean }[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entries) {
    const rel = relativePrefix ? `${relativePrefix}/${e.name}` : e.name;
    if (e.isFile() && e.name.endsWith(".md")) {
      out.push(rel);
    } else if (e.isDirectory() && !e.name.startsWith(".")) {
      out.push(...(await listMdFilesUnderPath(baseDir, rel)));
    }
  }
  return out;
};

export const serverDeleteDir = async (dirPath: string) => {
  try {
    await fs.rm(dirPath, { recursive: true });
  } catch (error) {
    const { logAudit } = await import("@/app/_server/actions/log");
    await logAudit({
      level: "DEBUG",
      action: "dir_delete",
      category: "file",
      success: false,
      errorMessage: `Directory delete failed (may not exist): ${dirPath}`,
    });
  }
};

export const readOrderFile = async (
  dirPath: string,
): Promise<OrderData | null> => {
  try {
    const filePath = path.join(dirPath, ".order.json");
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content) as OrderData;
    const categories = Array.isArray(data.categories)
      ? data.categories
      : undefined;
    const items = Array.isArray(data.items) ? data.items : undefined;
    return { categories, items };
  } catch {
    return null;
  }
};

export const writeOrderFile = async (
  dirPath: string,
  data: OrderData,
): Promise<{ success: boolean }> => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, ".order.json");
    const toWrite: OrderData = {};
    if (data.categories && data.categories.length > 0) {
      toWrite.categories = data.categories;
    }
    if (data.items && data.items.length > 0) {
      toWrite.items = data.items;
    }

    await fs.writeFile(filePath, JSON.stringify(toWrite, null, 2), "utf-8");
    return { success: true };
  } catch {
    return { success: false };
  }
};

const STAT_BATCH_SIZE = 4000;

export interface FileStatsEntry {
  birthtime: Date;
  mtime: Date;
}

export const getAllFileStats = async (
  dir: string,
): Promise<Map<string, FileStatsEntry>> => {
  const result = new Map<string, FileStatsEntry>();
  try {
    const { spawn } = await import("child_process");
    const paths = await new Promise<string[]>((resolve, reject) => {
      const child = spawn("find", [dir, "-name", "*.md", "-type", "f"], {
        stdio: ["ignore", "pipe", "ignore"],
      });
      const chunks: Buffer[] = [];
      child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0 && code !== null) {
          resolve([]);
          return;
        }
        const lines = Buffer.concat(chunks)
          .toString("utf-8")
          .trim()
          .split("\n")
          .filter(Boolean);
        resolve(lines);
      });
    });

    for (let i = 0; i < paths.length; i += STAT_BATCH_SIZE) {
      const batch = paths.slice(i, i + STAT_BATCH_SIZE);
      const entries = await Promise.all(
        batch.map(
          async (
            filePath,
          ): Promise<{ filePath: string; entry: FileStatsEntry } | null> => {
            try {
              const s = await fs.stat(filePath);
              const birthtime =
                s.birthtime.getTime() === 0 ? s.mtime : s.birthtime;
              return {
                filePath,
                entry: { birthtime, mtime: s.mtime },
              };
            } catch {
              return null;
            }
          },
        ),
      );
      for (const e of entries) {
        if (e) result.set(e.filePath, e.entry);
      }
    }
  } catch {
    return result;
  }
  return result;
};
