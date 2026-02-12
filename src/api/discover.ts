import type { DiscoverOptions, Project } from "./types.js";
import {
  buildArgs,
  executePj,
  executePjWithStdin,
  parseJsonOutput,
} from "../cli/executor.js";

/**
 * Discover projects using pj
 */
export async function discover(options?: DiscoverOptions): Promise<Project[]> {
  const args = buildArgs(options);
  const result = await executePj(args);
  return parseJsonOutput(result.stdout);
}

/**
 * Discover projects from specific paths provided via stdin
 *
 * This bypasses the configured paths and discovers projects only in the
 * provided paths. Useful for integrating with other tools that provide
 * a list of directories to search.
 */
export async function discoverFromPaths(
  paths: string[],
  options?: Omit<DiscoverOptions, "paths">
): Promise<Project[]> {
  // Build args without --path flags since we're using stdin
  // We explicitly omit paths by building options without it
  const optsWithoutPaths: DiscoverOptions = {};
  if (options?.markers !== undefined) optsWithoutPaths.markers = options.markers;
  if (options?.excludes !== undefined) optsWithoutPaths.excludes = options.excludes;
  if (options?.maxDepth !== undefined) optsWithoutPaths.maxDepth = options.maxDepth;
  if (options?.noIgnore !== undefined) optsWithoutPaths.noIgnore = options.noIgnore;
  if (options?.nested !== undefined) optsWithoutPaths.nested = options.nested;
  if (options?.noCache !== undefined) optsWithoutPaths.noCache = options.noCache;
  if (options?.icons !== undefined) optsWithoutPaths.icons = options.icons;
  if (options?.shorten !== undefined) optsWithoutPaths.shorten = options.shorten;
  if (options?.format !== undefined) optsWithoutPaths.format = options.format;
  if (options?.configPath !== undefined) optsWithoutPaths.configPath = options.configPath;
  if (options?.verbose !== undefined) optsWithoutPaths.verbose = options.verbose;

  const args = buildArgs(optsWithoutPaths);

  // Pass paths via stdin (one per line)
  const stdin = paths.join("\n");

  const result = await executePjWithStdin(args, stdin);

  return parseJsonOutput(result.stdout);
}

/**
 * Find a project by name
 */
export async function findProject(
  name: string,
  options?: DiscoverOptions
): Promise<Project | undefined> {
  const projects = await discover(options);
  return projects.find(
    (p) => p.name === name || p.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Find projects matching a pattern
 */
export async function findProjects(
  pattern: string | RegExp,
  options?: DiscoverOptions
): Promise<Project[]> {
  const projects = await discover(options);
  const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
  return projects.filter((p) => regex.test(p.name) || regex.test(p.path));
}

/**
 * Get projects grouped by marker type
 */
export async function discoverByMarker(
  options?: DiscoverOptions
): Promise<Map<string, Project[]>> {
  const projects = await discover(options);
  const grouped = new Map<string, Project[]>();

  for (const project of projects) {
    const existing = grouped.get(project.marker);
    if (existing) {
      existing.push(project);
    } else {
      grouped.set(project.marker, [project]);
    }
  }

  return grouped;
}

/**
 * Count projects by marker type
 */
export async function countByMarker(
  options?: DiscoverOptions
): Promise<Map<string, number>> {
  const grouped = await discoverByMarker(options);
  const counts = new Map<string, number>();

  for (const [marker, projects] of grouped) {
    counts.set(marker, projects.length);
  }

  return counts;
}
