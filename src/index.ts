/**
 * @joe-sh/pj - TypeScript API and binary installer for pj CLI
 *
 * A fast project finder that helps you quickly navigate to your projects.
 *
 * @example
 * ```typescript
 * import { Pj, discover } from '@joe-sh/pj';
 *
 * // Using the class-based API
 * const pj = new Pj();
 * const projects = await pj.discover();
 *
 * // Using standalone functions
 * const allProjects = await discover();
 * ```
 *
 * @packageDocumentation
 */

// Main class
export { Pj } from "./api/pj.js";

// Standalone discovery functions
export {
  discover,
  discoverFromPaths,
  findProject,
  findProjects,
  discoverByMarker,
  countByMarker,
} from "./api/discover.js";

// Configuration functions
export {
  loadConfig,
  saveConfig,
  configExists,
  getConfigPath,
  expandPath,
  expandConfigPaths,
  DEFAULT_CONFIG,
} from "./api/config.js";

// Cache functions
export { clearCache, getCacheInfo, getCachePath } from "./api/cache.js";

// Binary management
export { getBinaryManager, BinaryManager } from "./binary/manager.js";
export { detectPlatform, getAssetFilename, isPlatformSupported } from "./binary/platform.js";
export {
  GITHUB_OWNER,
  GITHUB_REPO,
  PJ_TARGET_VERSION,
  getBinaryName,
  getCacheDir,
  getBinaryCacheDir,
} from "./binary/constants.js";

// Version utilities
export {
  parseVersion,
  parseTargetVersion,
  isVersionCompatible,
  compareVersions,
  findHighestCompatibleVersion,
  type ParsedVersion,
} from "./binary/version.js";

// Types
export type {
  Project,
  DiscoverOptions,
  PjConfig,
  CacheInfo,
  BinaryStatus,
  BinaryOptions,
  DownloadProgress,
  GithubRelease,
  GithubAsset,
  Platform,
} from "./api/types.js";

// Error classes
export {
  PjBinaryError,
  PjExecutionError,
  PjConfigError,
} from "./api/types.js";

// CLI execution utilities (for advanced use)
export {
  buildArgs,
  parseJsonOutput,
  executePj,
  type PjResult,
} from "./cli/executor.js";
