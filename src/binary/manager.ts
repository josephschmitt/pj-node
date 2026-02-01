import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { execa } from "execa";
import * as tar from "tar";

import type {
  BinaryOptions,
  BinaryStatus,
  DownloadProgress,
  GithubAsset,
  GithubRelease,
} from "../api/types.js";
import { PjBinaryError } from "../api/types.js";
import {
  LATEST_RELEASE_URL,
  USER_AGENT,
  HTTP_TIMEOUT,
  UPDATE_CHECK_INTERVAL_DAYS,
  getBinaryCacheDir,
  getBinaryName,
  getMetadataPath,
} from "./constants.js";
import { detectPlatform, getAssetFilename } from "./platform.js";

interface CacheMetadata {
  version: string;
  installedAt: string;
  lastUpdateCheck: string;
  source: "download";
}

/**
 * Manages the pj binary installation and updates
 *
 * Note: This module uses `execa` for process execution which does NOT use shell
 * by default, preventing command injection vulnerabilities.
 */
export class BinaryManager {
  private cachedBinaryPath: string | null = null;

  /**
   * Get the path to the pj binary, downloading if necessary
   */
  async getBinaryPath(options?: BinaryOptions): Promise<string> {
    // Check environment override first
    const envPath = process.env["PJ_BINARY_PATH"];
    if (envPath) {
      if (await this.isValidBinary(envPath)) {
        return envPath;
      }
      throw new PjBinaryError(
        `PJ_BINARY_PATH is set but binary is not valid: ${envPath}`
      );
    }

    // Check for global installation
    const globalPath = await this.findGlobalBinary();
    if (globalPath) {
      return globalPath;
    }

    // Check cached binary
    const cachedPath = await this.getCachedBinaryPath();
    if (cachedPath && !options?.force) {
      // Check if update is needed
      const needsUpdate = await this.shouldCheckForUpdate();
      if (needsUpdate && options?.version === undefined) {
        try {
          await this.updateBinary(options);
        } catch {
          // If update fails, continue with existing binary
        }
      }
      return cachedPath;
    }

    // Download binary
    return await this.downloadBinary(options);
  }

  /**
   * Get the current binary status
   */
  async getStatus(): Promise<BinaryStatus> {
    // Check environment override
    const envPath = process.env["PJ_BINARY_PATH"];
    if (envPath && (await this.isValidBinary(envPath))) {
      const version = await this.getVersion(envPath);
      return {
        available: true,
        path: envPath,
        version,
        source: "env",
      };
    }

    // Check global installation
    const globalPath = await this.findGlobalBinary();
    if (globalPath) {
      const version = await this.getVersion(globalPath);
      return {
        available: true,
        path: globalPath,
        version,
        source: "global",
      };
    }

    // Check cached binary
    const cachedPath = await this.getCachedBinaryPath();
    if (cachedPath) {
      const version = await this.getVersion(cachedPath);
      return {
        available: true,
        path: cachedPath,
        version,
        source: "cache",
      };
    }

    return {
      available: false,
      path: null,
      version: null,
      source: null,
    };
  }

  /**
   * Download and install the pj binary
   */
  async downloadBinary(options?: BinaryOptions): Promise<string> {
    const release = options?.version
      ? await this.getRelease(options.version)
      : await this.getLatestRelease();

    const platform = detectPlatform();
    const assetName = getAssetFilename(release.version, platform);

    const asset = release.assets.find((a) => a.name === assetName);
    if (!asset) {
      throw new PjBinaryError(
        `No binary available for ${platform.pjOs}/${platform.pjArch}. ` +
          `Expected asset: ${assetName}`
      );
    }

    // Create cache directory
    const cacheDir = getBinaryCacheDir();
    await fs.mkdir(cacheDir, { recursive: true });

    // Download the tarball
    const tarballPath = path.join(cacheDir, assetName);
    await this.downloadAsset(asset, tarballPath, options?.onProgress);

    // Extract the binary
    const binaryName = getBinaryName();
    await tar.extract({
      file: tarballPath,
      cwd: cacheDir,
      filter: (entryPath) => path.basename(entryPath) === binaryName,
    });

    // Clean up tarball
    await fs.unlink(tarballPath);

    // Set executable permissions on Unix
    const binaryPath = path.join(cacheDir, binaryName);
    if (process.platform !== "win32") {
      await fs.chmod(binaryPath, 0o755);
    }

    // Verify the binary
    if (!(await this.isValidBinary(binaryPath))) {
      throw new PjBinaryError("Downloaded binary failed verification");
    }

    // Save metadata
    await this.saveMetadata({
      version: release.version,
      installedAt: new Date().toISOString(),
      lastUpdateCheck: new Date().toISOString(),
      source: "download",
    });

    this.cachedBinaryPath = binaryPath;
    return binaryPath;
  }

  /**
   * Update the binary to the latest version
   */
  async updateBinary(options?: BinaryOptions): Promise<string> {
    const latest = await this.getLatestRelease();
    const metadata = await this.getMetadata();

    if (metadata?.version === latest.version && !options?.force) {
      // Already up to date, just update the check timestamp
      await this.saveMetadata({
        ...metadata,
        lastUpdateCheck: new Date().toISOString(),
      });
      const cachedPath = await this.getCachedBinaryPath();
      if (cachedPath) {
        return cachedPath;
      }
    }

    return await this.downloadBinary({ ...options, version: latest.version });
  }

  /**
   * Get the version of a pj binary
   */
  async getVersion(binaryPath: string): Promise<string | null> {
    try {
      // execa does not use shell by default, safe from command injection
      const result = await execa(binaryPath, ["--version"], { timeout: 5000 });
      // pj outputs version like "pj version 1.4.1"
      const match = /(?:pj\s+)?(?:version\s+)?v?(\d+\.\d+\.\d+)/i.exec(
        result.stdout
      );
      return match?.[1] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a binary path is a valid pj binary
   */
  async isValidBinary(binaryPath: string): Promise<boolean> {
    try {
      await fs.access(binaryPath, fs.constants.X_OK);
      const version = await this.getVersion(binaryPath);
      return version !== null;
    } catch {
      return false;
    }
  }

  /**
   * Find the globally installed pj binary
   */
  private async findGlobalBinary(): Promise<string | null> {
    // execa does not use shell by default, safe from command injection
    try {
      const result = await execa("which", ["pj"], { timeout: 5000 });
      const binaryPath = result.stdout.trim();
      if (binaryPath && (await this.isValidBinary(binaryPath))) {
        return binaryPath;
      }
    } catch {
      // which failed or binary not found
    }

    // On Windows, try where
    if (process.platform === "win32") {
      try {
        const result = await execa("where", ["pj"], { timeout: 5000 });
        const binaryPath = result.stdout.trim().split("\n")[0];
        if (binaryPath && (await this.isValidBinary(binaryPath))) {
          return binaryPath;
        }
      } catch {
        // where failed or binary not found
      }
    }

    return null;
  }

  /**
   * Get the path to the cached binary if it exists
   */
  private async getCachedBinaryPath(): Promise<string | null> {
    if (this.cachedBinaryPath) {
      if (await this.isValidBinary(this.cachedBinaryPath)) {
        return this.cachedBinaryPath;
      }
      this.cachedBinaryPath = null;
    }

    const binaryPath = path.join(getBinaryCacheDir(), getBinaryName());
    if (await this.isValidBinary(binaryPath)) {
      this.cachedBinaryPath = binaryPath;
      return binaryPath;
    }

    return null;
  }

  /**
   * Check if we should check for updates
   */
  private async shouldCheckForUpdate(): Promise<boolean> {
    const metadata = await this.getMetadata();
    if (!metadata) {
      return true;
    }

    const lastCheck = new Date(metadata.lastUpdateCheck);
    const now = new Date();
    const daysSinceCheck =
      (now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceCheck >= UPDATE_CHECK_INTERVAL_DAYS;
  }

  /**
   * Get cached metadata
   */
  private async getMetadata(): Promise<CacheMetadata | null> {
    try {
      const content = await fs.readFile(getMetadataPath(), "utf-8");
      return JSON.parse(content) as CacheMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Save metadata to cache
   */
  private async saveMetadata(metadata: CacheMetadata): Promise<void> {
    const metadataPath = getMetadataPath();
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Get the latest release from GitHub
   */
  async getLatestRelease(): Promise<GithubRelease> {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT),
    });

    if (!response.ok) {
      throw new PjBinaryError(
        `Failed to fetch latest release: ${String(response.status)} ${response.statusText}`
      );
    }

    const data = (await response.json()) as {
      tag_name: string;
      name: string;
      prerelease: boolean;
      assets: {
        name: string;
        browser_download_url: string;
        size: number;
        content_type: string;
      }[];
    };

    return this.parseRelease(data);
  }

  /**
   * Get a specific release from GitHub
   */
  private async getRelease(version: string): Promise<GithubRelease> {
    const tag = version.startsWith("v") ? version : `v${version}`;
    const url = `${LATEST_RELEASE_URL.replace("/latest", "")}/${tag}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT),
    });

    if (!response.ok) {
      throw new PjBinaryError(
        `Failed to fetch release ${version}: ${String(response.status)} ${response.statusText}`
      );
    }

    const data = (await response.json()) as {
      tag_name: string;
      name: string;
      prerelease: boolean;
      assets: {
        name: string;
        browser_download_url: string;
        size: number;
        content_type: string;
      }[];
    };

    return this.parseRelease(data);
  }

  /**
   * Parse GitHub release response
   */
  private parseRelease(data: {
    tag_name: string;
    name: string;
    prerelease: boolean;
    assets: {
      name: string;
      browser_download_url: string;
      size: number;
      content_type: string;
    }[];
  }): GithubRelease {
    return {
      tagName: data.tag_name,
      version: data.tag_name.replace(/^v/, ""),
      name: data.name,
      prerelease: data.prerelease,
      assets: data.assets.map((asset) => ({
        name: asset.name,
        downloadUrl: asset.browser_download_url,
        size: asset.size,
        contentType: asset.content_type,
      })),
    };
  }

  /**
   * Download an asset to a file
   */
  private async downloadAsset(
    asset: GithubAsset,
    destPath: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    const response = await fetch(asset.downloadUrl, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT * 10), // Longer timeout for downloads
    });

    if (!response.ok) {
      throw new PjBinaryError(
        `Failed to download asset: ${String(response.status)} ${response.statusText}`
      );
    }

    if (!response.body) {
      throw new PjBinaryError("Response body is empty");
    }

    const total = asset.size;
    let downloaded = 0;

    const progressStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        downloaded += chunk.length;
        onProgress?.({
          downloaded,
          total,
          percent: Math.round((downloaded / total) * 100),
        });
        controller.enqueue(chunk);
      },
    });

    const fileStream = createWriteStream(destPath);

    await pipeline(
      Readable.fromWeb(response.body.pipeThrough(progressStream)),
      fileStream
    );
  }

  /**
   * Clear the binary cache
   */
  async clearCache(): Promise<void> {
    const cacheDir = getBinaryCacheDir();
    try {
      await fs.rm(cacheDir, { recursive: true, force: true });
    } catch {
      // Ignore errors if directory doesn't exist
    }

    const metadataPath = getMetadataPath();
    try {
      await fs.unlink(metadataPath);
    } catch {
      // Ignore errors if file doesn't exist
    }

    this.cachedBinaryPath = null;
  }
}

/** Singleton instance */
let binaryManager: BinaryManager | null = null;

/**
 * Get the singleton BinaryManager instance
 */
export function getBinaryManager(): BinaryManager {
  binaryManager ??= new BinaryManager();
  return binaryManager;
}
