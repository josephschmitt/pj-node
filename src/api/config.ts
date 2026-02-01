import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as yaml from "yaml";

import type { PjConfig } from "./types.js";
import { PjConfigError } from "./types.js";
import { getPjConfigPath } from "../binary/constants.js";

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: PjConfig = {
  paths: [
    path.join(os.homedir(), "projects"),
    path.join(os.homedir(), "code"),
    path.join(os.homedir(), "development"),
  ],
  markers: [
    ".git",
    "go.mod",
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    ".vscode",
    ".idea",
    "Makefile",
  ],
  exclude: ["node_modules", "vendor", ".cache", "target", "dist", "build"],
  maxDepth: 3,
  cacheTTL: 300,
  noIgnore: false,
  noNested: false,
  icons: {
    ".git": "\uf1d3 ", //
    "package.json": "\ue718 ", //
    "go.mod": "\ue626 ", //
    "Cargo.toml": "\ue7a8 ", //
    "pyproject.toml": "\ue73c ", //
    ".vscode": "\ue70c ", //
    ".idea": "\ue7b5 ", //
    Makefile: "\ue779 ", //
  },
};

/**
 * Load pj configuration from file
 */
export async function loadConfig(configPath?: string): Promise<PjConfig> {
  const filePath = configPath ?? getPjConfigPath();

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = yaml.parse(content) as Partial<RawConfig>;
    return mergeConfig(parsed);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      // Config file doesn't exist, return defaults
      return { ...DEFAULT_CONFIG };
    }
    throw new PjConfigError(
      `Failed to load config from ${filePath}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Save configuration to file
 */
export async function saveConfig(
  config: Partial<PjConfig>,
  configPath?: string
): Promise<void> {
  const filePath = configPath ?? getPjConfigPath();

  // Convert to raw format, only including defined properties
  const rawConfig: RawConfig = {};

  if (config.paths !== undefined) rawConfig.paths = config.paths;
  if (config.markers !== undefined) rawConfig.markers = config.markers;
  if (config.exclude !== undefined) rawConfig.exclude = config.exclude;
  if (config.maxDepth !== undefined) rawConfig.max_depth = config.maxDepth;
  if (config.cacheTTL !== undefined) rawConfig.cache_ttl = config.cacheTTL;
  if (config.noIgnore !== undefined) rawConfig.no_ignore = config.noIgnore;
  if (config.noNested !== undefined) rawConfig.no_nested = config.noNested;
  if (config.icons !== undefined) rawConfig.icons = config.icons;

  const content = yaml.stringify(rawConfig, { indent: 2 });

  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Check if a config file exists
 */
export async function configExists(configPath?: string): Promise<boolean> {
  const filePath = configPath ?? getPjConfigPath();
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the default config path
 */
export function getConfigPath(): string {
  return getPjConfigPath();
}

/**
 * Raw config format as stored in YAML (snake_case)
 */
interface RawConfig {
  paths?: string[];
  markers?: string[];
  exclude?: string[];
  max_depth?: number;
  cache_ttl?: number;
  no_ignore?: boolean;
  no_nested?: boolean;
  icons?: Record<string, string>;
}

/**
 * Merge raw config with defaults
 */
function mergeConfig(raw: Partial<RawConfig>): PjConfig {
  return {
    paths: raw.paths ?? DEFAULT_CONFIG.paths,
    markers: raw.markers ?? DEFAULT_CONFIG.markers,
    exclude: raw.exclude ?? DEFAULT_CONFIG.exclude,
    maxDepth: raw.max_depth ?? DEFAULT_CONFIG.maxDepth,
    cacheTTL: raw.cache_ttl ?? DEFAULT_CONFIG.cacheTTL,
    noIgnore: raw.no_ignore ?? DEFAULT_CONFIG.noIgnore,
    noNested: raw.no_nested ?? DEFAULT_CONFIG.noNested,
    icons: raw.icons ?? DEFAULT_CONFIG.icons,
  };
}

/**
 * Expand ~ in paths to home directory
 */
export function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  if (p === "~") {
    return os.homedir();
  }
  return p;
}

/**
 * Expand all paths in config
 */
export function expandConfigPaths(config: PjConfig): PjConfig {
  return {
    ...config,
    paths: config.paths.map(expandPath),
  };
}
