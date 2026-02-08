import * as path from "node:path";
import * as os from "node:os";

/**
 * Target pj version (major.minor) that this package is compatible with.
 * The installer will accept any patch version within this range.
 * Example: "1.4" means pj 1.4.0, 1.4.1, 1.4.2, etc. are all compatible.
 *
 * IMPORTANT: When pj releases a new minor version (e.g., 1.5.0),
 * this package must also release a new minor version to match.
 */
export const PJ_TARGET_VERSION = "1.11";

/** GitHub repository owner */
export const GITHUB_OWNER = "josephschmitt";

/** GitHub repository name */
export const GITHUB_REPO = "pj";

/** GitHub API base URL */
export const GITHUB_API_URL = "https://api.github.com";

/** GitHub releases API endpoint */
export const RELEASES_URL = `${GITHUB_API_URL}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

/** Latest release API endpoint */
export const LATEST_RELEASE_URL = `${RELEASES_URL}/latest`;

/** Binary name (without extension) */
export const BINARY_NAME = "pj";

/** Binary name on Windows */
export const BINARY_NAME_WIN = "pj.exe";

/** Get the appropriate binary name for the current platform */
export function getBinaryName(): string {
  return process.platform === "win32" ? BINARY_NAME_WIN : BINARY_NAME;
}

/** Cache directory for pj-node */
export function getCacheDir(): string {
  const xdgCache = process.env["XDG_CACHE_HOME"];
  if (xdgCache) {
    return path.join(xdgCache, "pj-node");
  }

  if (process.platform === "win32") {
    const localAppData = process.env["LOCALAPPDATA"];
    if (localAppData) {
      return path.join(localAppData, "pj-node", "cache");
    }
    return path.join(os.homedir(), "AppData", "Local", "pj-node", "cache");
  }

  return path.join(os.homedir(), ".cache", "pj-node");
}

/** Binary cache directory */
export function getBinaryCacheDir(): string {
  return path.join(getCacheDir(), "bin");
}

/** Metadata file path */
export function getMetadataPath(): string {
  return path.join(getCacheDir(), "metadata.json");
}

/** pj config directory */
export function getPjConfigDir(): string {
  const xdgConfig = process.env["XDG_CONFIG_HOME"];
  if (xdgConfig) {
    return path.join(xdgConfig, "pj");
  }

  if (process.platform === "win32") {
    const appData = process.env["APPDATA"];
    if (appData) {
      return path.join(appData, "pj");
    }
    return path.join(os.homedir(), "AppData", "Roaming", "pj");
  }

  return path.join(os.homedir(), ".config", "pj");
}

/** pj config file path */
export function getPjConfigPath(): string {
  return path.join(getPjConfigDir(), "config.yaml");
}

/** pj cache directory */
export function getPjCacheDir(): string {
  const xdgCache = process.env["XDG_CACHE_HOME"];
  if (xdgCache) {
    return path.join(xdgCache, "pj");
  }

  if (process.platform === "win32") {
    const localAppData = process.env["LOCALAPPDATA"];
    if (localAppData) {
      return path.join(localAppData, "pj", "cache");
    }
    return path.join(os.homedir(), "AppData", "Local", "pj", "cache");
  }

  return path.join(os.homedir(), ".cache", "pj");
}

/** User agent for GitHub API requests */
export const USER_AGENT = "@joe-sh/pj";

/** Default timeout for HTTP requests in milliseconds */
export const HTTP_TIMEOUT = 30000;

/** Update check interval in days */
export const UPDATE_CHECK_INTERVAL_DAYS = 7;
