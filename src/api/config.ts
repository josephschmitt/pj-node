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
    "Makefile",
    "flake.nix",
    ".vscode",
    ".idea",
    ".fleet",
    ".project",
    ".zed",
    "Dockerfile",
  ],
  exclude: [
    "node_modules",
    ".terraform",
    "vendor",
    ".git",
    "target",
    "dist",
    "build",
  ],
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
    Dockerfile: "\ue7b0",
  },
  colors: {
    ".git": "bright-red",
    "package.json": "green",
    "go.mod": "cyan",
    "Cargo.toml": "red",
    "pyproject.toml": "yellow",
    ".vscode": "blue",
    ".idea": "magenta",
    ".fleet": "magenta",
    ".project": "blue",
    ".zed": "blue",
    Makefile: "white",
    "flake.nix": "bright-blue",
    Dockerfile: "cyan",
  },
  priorities: {
    ".git": 1,
    "go.mod": 10,
    "package.json": 10,
    "Cargo.toml": 10,
    "pyproject.toml": 10,
    Makefile: 1,
    "flake.nix": 10,
    ".vscode": 5,
    ".idea": 5,
    ".fleet": 5,
    ".project": 5,
    ".zed": 5,
    Dockerfile: 7,
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
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- support legacy format
  if (config.icons !== undefined) rawConfig.icons = config.icons;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- support legacy format
  if (config.colors !== undefined) rawConfig.colors = config.colors;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- support legacy format
  if (config.priorities !== undefined) rawConfig.priorities = config.priorities;

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
 * Raw marker config - can be a string or an object with marker, icon, and priority
 */
type RawMarker =
  | string
  | {
      marker: string;
      icon?: string;
      color?: string;
      priority?: number;
    };

/**
 * Raw config format as stored in YAML (snake_case)
 */
interface RawConfig {
  paths?: string[];
  markers?: RawMarker[];
  exclude?: string[];
  max_depth?: number;
  cache_ttl?: number;
  no_ignore?: boolean;
  no_nested?: boolean;
  /** @deprecated Use the new markers format with icon field instead */
  icons?: Record<string, string>;
  /** @deprecated Use the new markers format with color field instead */
  colors?: Record<string, string>;
  /** @deprecated Use the new markers format with priority field instead */
  priorities?: Record<string, number>;
}

/**
 * Parse raw markers into separate markers, icons, and priorities
 */
function parseRawMarkers(rawMarkers: RawMarker[]): {
  markers: string[];
  icons: Record<string, string>;
  colors: Record<string, string>;
  priorities: Record<string, number>;
} {
  const markers: string[] = [];
  const icons: Record<string, string> = {};
  const colors: Record<string, string> = {};
  const priorities: Record<string, number> = {};

  for (const raw of rawMarkers) {
    if (typeof raw === "string") {
      markers.push(raw);
    } else {
      markers.push(raw.marker);
      if (raw.icon !== undefined) {
        icons[raw.marker] = raw.icon;
      }
      if (raw.color !== undefined) {
        colors[raw.marker] = raw.color;
      }
      if (raw.priority !== undefined) {
        priorities[raw.marker] = raw.priority;
      }
    }
  }

  return { markers, icons, colors, priorities };
}

/**
 * Merge raw config with defaults
 */
function mergeConfig(raw: Partial<RawConfig>): PjConfig {
  // Parse markers from raw config if provided
  let markers = DEFAULT_CONFIG.markers;
  let parsedIcons: Record<string, string> = {};
  let parsedColors: Record<string, string> = {};
  let parsedPriorities: Record<string, number> = {};

  if (raw.markers !== undefined) {
    const parsed = parseRawMarkers(raw.markers);
    markers = parsed.markers;
    parsedIcons = parsed.icons;
    parsedColors = parsed.colors;
    parsedPriorities = parsed.priorities;
  }

  // Merge icons: defaults <- deprecated icons field <- new format icons
  const icons = {
    ...DEFAULT_CONFIG.icons,
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- support legacy format
    ...(raw.icons ?? {}),
    ...parsedIcons,
  };

  // Merge colors: defaults <- deprecated colors field <- new format colors
  const colors = {
    ...DEFAULT_CONFIG.colors,
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- support legacy format
    ...(raw.colors ?? {}),
    ...parsedColors,
  };

  // Merge priorities: defaults <- deprecated priorities field <- new format priorities
  const priorities = {
    ...DEFAULT_CONFIG.priorities,
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- support legacy format
    ...(raw.priorities ?? {}),
    ...parsedPriorities,
  };

  return {
    paths: raw.paths ?? DEFAULT_CONFIG.paths,
    markers,
    exclude: raw.exclude ?? DEFAULT_CONFIG.exclude,
    maxDepth: raw.max_depth ?? DEFAULT_CONFIG.maxDepth,
    cacheTTL: raw.cache_ttl ?? DEFAULT_CONFIG.cacheTTL,
    noIgnore: raw.no_ignore ?? DEFAULT_CONFIG.noIgnore,
    noNested: raw.no_nested ?? DEFAULT_CONFIG.noNested,
    icons,
    colors,
    priorities,
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
