"use server";

import fs from "fs/promises";
import path from "path";

/**
 * Reads and parses a JSON file.
 * Returns null if the file doesn't exist or is invalid,
 * except for users.json which returns an empty array.
 */
export const readJsonFile = async (filePath: string): Promise<any> => {
  try {
    if (!filePath) return null;

    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    const content = await fs.readFile(fullPath, "utf-8");

    if (!content || !content.trim()) {
      return filePath.includes("users.json") ? [] : null;
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error(`JSON Parse Error in ${filePath}:`, parseError);
      return filePath.includes("users.json") ? [] : null;
    }
  } catch (error: any) {
    // If file doesn't exist, it's not necessarily an error we need to log loudly
    if (error.code === 'ENOENT') {
      return filePath.includes("users.json") ? [] : null;
    }
    console.error(`Error reading JSON file ${filePath}:`, error);
    return filePath.includes("users.json") ? [] : null;
  }
};

/**
 * Writes data to a JSON file, ensuring the directory exists.
 */
export const writeJsonFile = async (
  data: any,
  filePath: string,
): Promise<void> => {
  try {
    if (!filePath) throw new Error("No file path provided to writeJsonFile");

    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(fullPath, content, "utf-8");
  } catch (error) {
    console.error(`Error writing JSON data to ${filePath}:`, error);
    throw error;
  }
};

export const ensureDir = async (dir: string) => {
  try {
    const fullDir = path.isAbsolute(dir)
      ? dir
      : path.resolve(process.cwd(), dir);
    await fs.access(fullDir);
  } catch {
    const fullDir = path.isAbsolute(dir)
      ? dir
      : path.resolve(process.cwd(), dir);
    await fs.mkdir(fullDir, { recursive: true });
  }
};

export const ensureFile = async (filePath: string) => {
  try {
    const fullFile = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    await fs.access(fullFile);
  } catch {
    const fullFile = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    await fs.mkdir(path.dirname(fullFile), { recursive: true });
    await fs.writeFile(fullFile, "", "utf-8");
  }
};
