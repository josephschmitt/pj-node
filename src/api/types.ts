/**
 * A discovered project from pj
 */
export interface Project {
  /** Absolute path to the project directory */
  path: string;
  /** Display path (with ~ for home directory when --shorten is used) */
  displayPath: string | undefined;
  /** Name of the project (directory name) */
  name: string;
  /** The marker file/directory that identified this as a project */
  marker: string;
  /** Optional label for the marker (human-readable name) */
  label: string | undefined;
  /** Optional label with ANSI color codes applied (when --icons is used) */
  displayLabel: string | undefined;
  /** Optional icon for the marker (Nerd Font) */
  icon: string | undefined;
  /** Optional icon with ANSI color codes applied (when --icons is used) */
  ansiIcon: string | undefined;
  /** Optional color name for the marker icon (e.g., "cyan", "bright-red") */
  color: string | undefined;
  /** Priority of the marker (higher = more specific) */
  priority: number | undefined;
}

/**
 * Options for project discovery
 */
export interface DiscoverOptions {
  /** Paths to search for projects */
  paths?: string[];
  /** Project marker files/directories to look for */
  markers?: string[];
  /** Patterns to exclude from search */
  excludes?: string[];
  /** Maximum directory depth to search */
  maxDepth?: number;
  /** Don't respect .gitignore files */
  noIgnore?: boolean;
  /** Allow nested project detection */
  nested?: boolean;
  /** Bypass cache and do fresh discovery */
  noCache?: boolean;
  /** Include icons in output */
  icons?: boolean;
  /** Replace home directory with ~ in output paths */
  shorten?: boolean;
  /** Sort order for results: "alpha", "priority" (default), or "label" */
  sort?: "alpha" | "priority" | "label";
  /** Sort direction: "asc" or "desc" (defaults vary by sort mode) */
  sortDirection?: "asc" | "desc";
  /** Custom output format template (Go template syntax) */
  format?: string;
  /** Custom config file path */
  configPath?: string;
  /** Enable verbose/debug output */
  verbose?: boolean;
}

/**
 * Configuration for pj
 */
export interface PjConfig {
  /** Paths to search for projects */
  paths: string[];
  /** Project marker files/directories */
  markers: string[];
  /** Patterns to exclude */
  exclude: string[];
  /** Maximum search depth */
  maxDepth: number;
  /** Cache time-to-live in seconds */
  cacheTTL: number;
  /** Don't respect .gitignore */
  noIgnore: boolean;
  /** Allow nested projects */
  noNested: boolean;
  /** Icon mappings for markers */
  icons: Record<string, string>;
  /** Color mappings for marker icons */
  colors: Record<string, string>;
  /** Priority mappings for markers (higher = more specific) */
  priorities: Record<string, number>;
}

/**
 * Information about the pj cache
 */
export interface CacheInfo {
  /** Whether the cache exists */
  exists: boolean;
  /** Path to the cache directory */
  path: string;
  /** Number of cache files */
  fileCount: number;
  /** Total size in bytes */
  totalSize: number;
}

/**
 * Binary installation status
 */
export interface BinaryStatus {
  /** Whether a binary is available */
  available: boolean;
  /** Path to the binary */
  path: string | null;
  /** Version of the binary */
  version: string | null;
  /** Source of the binary: 'global', 'cache', or 'env' */
  source: "global" | "cache" | "env" | null;
}

/**
 * Options for binary management
 */
export interface BinaryOptions {
  /** Force download even if binary exists */
  force?: boolean;
  /** Specific version to install (defaults to latest) */
  version?: string;
  /** Progress callback for downloads */
  onProgress?: (progress: DownloadProgress) => void;
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  /** Bytes downloaded so far */
  downloaded: number;
  /** Total bytes to download (may be undefined if unknown) */
  total?: number;
  /** Percentage complete (0-100) */
  percent?: number;
}

/**
 * GitHub release information
 */
export interface GithubRelease {
  /** Release tag name (e.g., "v1.4.1") */
  tagName: string;
  /** Release version without 'v' prefix */
  version: string;
  /** Release name/title */
  name: string;
  /** Whether this is a prerelease */
  prerelease: boolean;
  /** Release assets */
  assets: GithubAsset[];
}

/**
 * GitHub release asset
 */
export interface GithubAsset {
  /** Asset name (e.g., "pj_1.4.1_darwin_arm64.tar.gz") */
  name: string;
  /** Download URL */
  downloadUrl: string;
  /** File size in bytes */
  size: number;
  /** Content type */
  contentType: string;
}

/**
 * Platform information
 */
export interface Platform {
  /** Operating system: darwin, linux, win32 */
  os: "darwin" | "linux" | "win32";
  /** Architecture: x64, arm64 */
  arch: "x64" | "arm64";
  /** pj asset OS name */
  pjOs: "darwin" | "linux" | "windows";
  /** pj asset architecture name */
  pjArch: "amd64" | "arm64";
}

/**
 * Error thrown when binary operations fail
 */
export class PjBinaryError extends Error {
  constructor(
    message: string,
    public override readonly cause?: Error
  ) {
    super(message, { cause });
    this.name = "PjBinaryError";
  }
}

/**
 * Error thrown when pj execution fails
 */
export class PjExecutionError extends Error {
  public readonly exitCode: number | undefined;
  public readonly stderr: string | undefined;

  constructor(message: string, exitCode?: number, stderr?: string) {
    super(message);
    this.name = "PjExecutionError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class PjConfigError extends Error {
  constructor(
    message: string,
    public override readonly cause?: Error
  ) {
    super(message, { cause });
    this.name = "PjConfigError";
  }
}
