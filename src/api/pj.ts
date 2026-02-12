import type {
  BinaryOptions,
  BinaryStatus,
  CacheInfo,
  DiscoverOptions,
  PjConfig,
  Project,
} from "./types.js";
import {
  discover,
  discoverFromPaths,
  findProject,
  findProjects,
  discoverByMarker,
  countByMarker,
} from "./discover.js";
import { loadConfig, saveConfig, DEFAULT_CONFIG } from "./config.js";
import { clearCache, getCacheInfo } from "./cache.js";
import { getBinaryManager } from "../binary/manager.js";

/**
 * Main class for interacting with pj
 *
 * Provides a high-level API for project discovery, configuration management,
 * and binary management.
 *
 * @example
 * ```typescript
 * const pj = new Pj();
 *
 * // Discover all projects
 * const projects = await pj.discover();
 *
 * // Find a specific project
 * const myProject = await pj.findProject('my-app');
 *
 * // Search for projects
 * const reactProjects = await pj.findProjects(/react/i);
 * ```
 */
export class Pj {
  private config: PjConfig;

  /**
   * Create a new Pj instance
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<PjConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Discover all projects
   *
   * @param options - Discovery options
   * @returns Array of discovered projects
   */
  async discover(options?: DiscoverOptions): Promise<Project[]> {
    return discover(this.mergeOptions(options));
  }

  /**
   * Discover projects from specific paths
   *
   * Bypasses configured paths and searches only the provided paths.
   * Useful for integration with other tools.
   *
   * @param paths - Paths to search
   * @param options - Additional discovery options
   */
  async discoverFromPaths(
    paths: string[],
    options?: Omit<DiscoverOptions, "paths">
  ): Promise<Project[]> {
    return discoverFromPaths(paths, this.mergeOptions(options));
  }

  /**
   * Find a project by name
   *
   * @param name - Project name to find
   * @param options - Discovery options
   */
  async findProject(
    name: string,
    options?: DiscoverOptions
  ): Promise<Project | undefined> {
    return findProject(name, this.mergeOptions(options));
  }

  /**
   * Find projects matching a pattern
   *
   * @param pattern - String or regex pattern to match
   * @param options - Discovery options
   */
  async findProjects(
    pattern: string | RegExp,
    options?: DiscoverOptions
  ): Promise<Project[]> {
    return findProjects(pattern, this.mergeOptions(options));
  }

  /**
   * Get projects grouped by marker type
   *
   * @param options - Discovery options
   */
  async discoverByMarker(
    options?: DiscoverOptions
  ): Promise<Map<string, Project[]>> {
    return discoverByMarker(this.mergeOptions(options));
  }

  /**
   * Count projects by marker type
   *
   * @param options - Discovery options
   */
  async countByMarker(options?: DiscoverOptions): Promise<Map<string, number>> {
    return countByMarker(this.mergeOptions(options));
  }

  /**
   * Clear the pj project cache
   */
  async clearCache(): Promise<void> {
    return clearCache();
  }

  /**
   * Get information about the pj cache
   */
  async getCacheInfo(): Promise<CacheInfo> {
    return getCacheInfo();
  }

  /**
   * Load configuration from file
   *
   * @param configPath - Optional path to config file
   */
  async loadConfig(configPath?: string): Promise<PjConfig> {
    const loaded = await loadConfig(configPath);
    this.config = loaded;
    return loaded;
  }

  /**
   * Save configuration to file
   *
   * @param config - Configuration to save (uses current config if not provided)
   * @param configPath - Optional path to config file
   */
  async saveConfig(config?: Partial<PjConfig>, configPath?: string): Promise<void> {
    const toSave = config ? { ...this.config, ...config } : this.config;
    await saveConfig(toSave, configPath);
  }

  /**
   * Get current configuration
   */
  getConfig(): PjConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to merge
   */
  setConfig(config: Partial<PjConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Ensure the pj binary is available
   *
   * Downloads the binary if not already installed.
   *
   * @param options - Binary options
   * @returns Path to the binary
   */
  async ensureBinary(options?: BinaryOptions): Promise<string> {
    const manager = getBinaryManager();
    return manager.getBinaryPath(options);
  }

  /**
   * Get the status of the pj binary
   */
  async getBinaryStatus(): Promise<BinaryStatus> {
    const manager = getBinaryManager();
    return manager.getStatus();
  }

  /**
   * Update the pj binary to the latest version
   *
   * @param options - Binary options
   * @returns Path to the updated binary
   */
  async updateBinary(options?: BinaryOptions): Promise<string> {
    const manager = getBinaryManager();
    return manager.updateBinary(options);
  }

  /**
   * Get the version of the pj binary
   */
  async getBinaryVersion(): Promise<string | null> {
    const manager = getBinaryManager();
    const status = await manager.getStatus();
    return status.version;
  }

  /**
   * Merge instance config with provided options
   */
  private mergeOptions(options?: DiscoverOptions): DiscoverOptions {
    const merged: DiscoverOptions = {
      paths: options?.paths ?? this.config.paths,
      markers: options?.markers ?? this.config.markers,
      excludes: options?.excludes ?? this.config.exclude,
      maxDepth: options?.maxDepth ?? this.config.maxDepth,
      noIgnore: options?.noIgnore ?? this.config.noIgnore,
      nested: options?.nested ?? !this.config.noNested,
    };

    // Only include optional properties if they have values
    if (options?.icons !== undefined) {
      merged.icons = options.icons;
    }
    if (options?.shorten !== undefined) {
      merged.shorten = options.shorten;
    }
    if (options?.format !== undefined) {
      merged.format = options.format;
    }
    if (options?.noCache !== undefined) {
      merged.noCache = options.noCache;
    }
    if (options?.configPath !== undefined) {
      merged.configPath = options.configPath;
    }
    if (options?.verbose !== undefined) {
      merged.verbose = options.verbose;
    }

    return merged;
  }
}
