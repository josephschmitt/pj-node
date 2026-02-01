import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { CacheInfo } from "./types.js";
import { getPjCacheDir } from "../binary/constants.js";
import { executePj } from "../cli/executor.js";

/**
 * Clear the pj project cache
 */
export async function clearCache(): Promise<void> {
  await executePj(["--clear-cache"]);
}

/**
 * Get information about the pj cache
 */
export async function getCacheInfo(): Promise<CacheInfo> {
  const cacheDir = getPjCacheDir();

  try {
    const stats = await fs.stat(cacheDir);
    if (!stats.isDirectory()) {
      return {
        exists: false,
        path: cacheDir,
        fileCount: 0,
        totalSize: 0,
      };
    }

    const files = await fs.readdir(cacheDir);
    let totalSize = 0;
    let fileCount = 0;

    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = path.join(cacheDir, file);
        const fileStats = await fs.stat(filePath);
        totalSize += fileStats.size;
        fileCount++;
      }
    }

    return {
      exists: true,
      path: cacheDir,
      fileCount,
      totalSize,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        exists: false,
        path: cacheDir,
        fileCount: 0,
        totalSize: 0,
      };
    }
    throw error;
  }
}

/**
 * Get the cache directory path
 */
export function getCachePath(): string {
  return getPjCacheDir();
}
