"use server";

import fs from "fs/promises";
import path from "path";

export const readJsonFile = async (filePath: string): Promise<any> => {
  try {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, "utf-8");
    if (!content.trim()) return null;
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
};

export const writeJsonFile = async (
  data: any,
  filePath: string,
): Promise<void> => {
  try {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(
      fullPath,
      JSON.stringify(data, null, 2),
      "utf-8",
    );
  } catch (error) {
    console.error("Error writing data:", error);
    throw error;
  }
};
