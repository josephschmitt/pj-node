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
  RELEASES_URL,
  LATEST_RELEASE_URL,
  USER_AGENT,
  HTTP_TIMEOUT,
  UPDATE_CHECK_INTERVAL_DAYS,
  PJ_TARGET_VERSION,
  getBinaryCacheDir,
  getBinaryName,
  getMetadataPath,
} from "./constants.js";
import { detectPlatform, getAssetFilename } from "./platform.js";
import {
  isVersionCompatible,
  findHighestCompatibleVersion,
} from "./version.js";

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
   * Download and install the pj binary.
   * If no specific version is requested, downloads the highest compatible version
   * within the target major.minor range.
   */
  async downloadBinary(options?: BinaryOptions): Promise<string> {
    const release = options?.version
      ? await this.getRelease(options.version)
      : await this.getCompatibleRelease();

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
   * Update the binary to the highest compatible version within the target range.
   */
  async updateBinary(options?: BinaryOptions): Promise<string> {
    const compatible = await this.getCompatibleRelease();
    const metadata = await this.getMetadata();

    if (metadata?.version === compatible.version && !options?.force) {
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

    return await this.downloadBinary({
      ...options,
      version: compatible.version,
    });
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
   * Find the globally installed pj binary.
   * Only returns the binary if it's version-compatible with our target.
   */
  private async findGlobalBinary(): Promise<string | null> {
    // execa does not use shell by default, safe from command injection
    let binaryPath: string | null = null;

    try {
      const result = await execa("which", ["pj"], { timeout: 5000 });
      binaryPath = result.stdout.trim();
    } catch {
      // which failed or binary not found
    }

    // On Windows, try where
    if (!binaryPath && process.platform === "win32") {
      try {
        const result = await execa("where", ["pj"], { timeout: 5000 });
        binaryPath = result.stdout.trim().split("\n")[0] ?? null;
      } catch {
        // where failed or binary not found
      }
    }

    if (!binaryPath) {
      return null;
    }

    // Check if the binary is valid
    if (!(await this.isValidBinary(binaryPath))) {
      return null;
    }

    // Check if the version is compatible
    const version = await this.getVersion(binaryPath);
    if (!version || !isVersionCompatible(version, PJ_TARGET_VERSION)) {
      return null;
    }

    return binaryPath;
  }

  /**
   * Get the path to the cached binary if it exists and is version-compatible.
   */
  private async getCachedBinaryPath(): Promise<string | null> {
    if (this.cachedBinaryPath) {
      if (await this.isValidBinary(this.cachedBinaryPath)) {
        // Verify version compatibility
        const version = await this.getVersion(this.cachedBinaryPath);
        if (version && isVersionCompatible(version, PJ_TARGET_VERSION)) {
          return this.cachedBinaryPath;
        }
      }
      this.cachedBinaryPath = null;
    }

    const binaryPath = path.join(getBinaryCacheDir(), getBinaryName());
    if (await this.isValidBinary(binaryPath)) {
      // Verify version compatibility
      const version = await this.getVersion(binaryPath);
      if (version && isVersionCompatible(version, PJ_TARGET_VERSION)) {
        this.cachedBinaryPath = binaryPath;
        return binaryPath;
      }
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
   * Get all releases from GitHub (up to 100 most recent)
   */
  async getAllReleases(): Promise<GithubRelease[]> {
    const response = await fetch(`${RELEASES_URL}?per_page=100`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT),
    });

    if (!response.ok) {
      throw new PjBinaryError(
        `Failed to fetch releases: ${String(response.status)} ${response.statusText}`
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
    }[];

    return data
      .filter((release) => !release.prerelease)
      .map((release) => this.parseRelease(release));
  }

  /**
   * Get the highest compatible release within the target major.minor range.
   */
  async getCompatibleRelease(): Promise<GithubRelease> {
    const releases = await this.getAllReleases();
    const versions = releases.map((r) => r.version);

    const compatibleVersion = findHighestCompatibleVersion(
      versions,
      PJ_TARGET_VERSION
    );

    if (!compatibleVersion) {
      throw new PjBinaryError(
        `No compatible pj release found for version range ${PJ_TARGET_VERSION}.x. ` +
          `Available versions: ${versions.join(", ")}`
      );
    }

    const release = releases.find((r) => r.version === compatibleVersion);
    if (!release) {
      throw new PjBinaryError(
        `Failed to find release for version ${compatibleVersion}`
      );
    }

    return release;
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
