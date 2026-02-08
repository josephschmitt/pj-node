import { execa, type Options as ExecaOptions } from "execa";

import type { DiscoverOptions, Project } from "../api/types.js";
import { PjExecutionError } from "../api/types.js";
import { getBinaryManager } from "../binary/manager.js";

/**
 * Result from executing pj
 */
export interface PjResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Build command-line arguments from DiscoverOptions
 */
export function buildArgs(options?: DiscoverOptions): string[] {
  const args: string[] = [];

  if (options?.paths) {
    for (const p of options.paths) {
      args.push("--path", p);
    }
  }

  if (options?.markers) {
    for (const m of options.markers) {
      args.push("--marker", m);
    }
  }

  if (options?.excludes) {
    for (const e of options.excludes) {
      args.push("--exclude", e);
    }
  }

  if (options?.maxDepth !== undefined) {
    args.push("--max-depth", String(options.maxDepth));
  }

  if (options?.noIgnore) {
    args.push("--no-ignore");
  }

  if (options?.nested === false) {
    args.push("--no-nested");
  }

  if (options?.noCache) {
    args.push("--no-cache");
  }

  if (options?.icons) {
    args.push("--icons");
  }

  if (options?.configPath) {
    args.push("--config", options.configPath);
  }

  if (options?.verbose) {
    args.push("--verbose");
  }

  // Always request JSON output for programmatic use
  args.push("--json");

  return args;
}

/**
 * JSON structure returned by pj binary
 */
interface PjJsonProject {
  path: string;
  name: string;
  marker: string;
  icon?: string;
  color?: string;
}

interface PjJsonOutput {
  projects: PjJsonProject[];
}

/**
 * Parse JSON output from pj
 */
export function parseJsonOutput(output: string): Project[] {
  if (!output.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(output) as PjJsonOutput | PjJsonProject[];

    // Handle both wrapped format { "projects": [...] } and direct array format
    const projects = Array.isArray(parsed) ? parsed : parsed.projects;

    if (!Array.isArray(projects)) {
      throw new PjExecutionError(
        `Unexpected pj output format: expected projects array but got ${typeof parsed}`
      );
    }

    return projects.map((p) => ({
      path: p.path,
      name: p.name,
      marker: p.marker,
      icon: p.icon,
      color: p.color,
      priority: undefined,  // not included in JSON output
    }));
  } catch (error) {
    if (error instanceof PjExecutionError) {
      throw error;
    }
    throw new PjExecutionError(
      `Failed to parse pj output: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Execute the pj binary with the given arguments
 *
 * Note: This function uses `execa` which does NOT use shell by default,
 * preventing command injection vulnerabilities.
 */
export async function executePj(
  args: string[],
  execaOptions?: ExecaOptions
): Promise<PjResult> {
  const binaryManager = getBinaryManager();
  const binaryPath = await binaryManager.getBinaryPath();

  try {
    // execa does not use shell by default, safe from command injection
    // stdin: 'ignore' prevents hanging when called from Node.js environments
    // that inherit stdin from parent process (e.g., Raycast, VS Code extensions)
    const result = await execa(binaryPath, args, {
      stdin: "ignore",
      timeout: 60000, // 1 minute timeout
      ...execaOptions,
    });

    return {
      stdout: String(result.stdout ?? ""),
      stderr: String(result.stderr ?? ""),
      exitCode: result.exitCode ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && "exitCode" in error) {
      const execaError = error as Error & {
        exitCode?: number;
        stderr?: string;
      };
      throw new PjExecutionError(
        `pj command failed: ${execaError.message}`,
        execaError.exitCode,
        execaError.stderr
      );
    }
    throw error;
  }
}

/**
 * Execute pj with stdin input
 *
 * Note: This function uses `execa` which does NOT use shell by default,
 * preventing command injection vulnerabilities.
 */
export async function executePjWithStdin(
  args: string[],
  stdin: string,
  execaOptions?: ExecaOptions
): Promise<PjResult> {
  const binaryManager = getBinaryManager();
  const binaryPath = await binaryManager.getBinaryPath();

  try {
    // execa does not use shell by default, safe from command injection
    const result = await execa(binaryPath, args, {
      input: stdin,
      timeout: 60000,
      ...execaOptions,
    });

    return {
      stdout: String(result.stdout ?? ""),
      stderr: String(result.stderr ?? ""),
      exitCode: result.exitCode ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && "exitCode" in error) {
      const execaError = error as Error & {
        exitCode?: number;
        stderr?: string;
      };
      throw new PjExecutionError(
        `pj command failed: ${execaError.message}`,
        execaError.exitCode,
        execaError.stderr
      );
    }
    throw error;
  }
}
