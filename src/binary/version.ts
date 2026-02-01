import { PJ_TARGET_VERSION } from "./constants.js";

/**
 * Parsed semantic version
 */
export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

/**
 * Parse a semantic version string
 */
export function parseVersion(version: string): ParsedVersion | null {
  // Remove leading 'v' if present
  const normalized = version.replace(/^v/, "");
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(normalized);

  if (!match || !match[1] || !match[2] || !match[3]) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    raw: normalized,
  };
}

/**
 * Parse a major.minor version target (e.g., "1.4")
 */
export function parseTargetVersion(
  target: string
): { major: number; minor: number } | null {
  const match = /^(\d+)\.(\d+)$/.exec(target);
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
  };
}

/**
 * Check if a version is compatible with the target major.minor version.
 * A version is compatible if it has the same major.minor version.
 *
 * Example: target "1.4" is compatible with "1.4.0", "1.4.1", "1.4.99"
 *          but NOT with "1.3.0", "1.5.0", or "2.4.0"
 */
export function isVersionCompatible(
  version: string,
  target: string = PJ_TARGET_VERSION
): boolean {
  const parsed = parseVersion(version);
  const targetParsed = parseTargetVersion(target);

  if (!parsed || !targetParsed) {
    return false;
  }

  return (
    parsed.major === targetParsed.major && parsed.minor === targetParsed.minor
  );
}

/**
 * Compare two versions. Returns:
 * - negative if a < b
 * - positive if a > b
 * - 0 if a === b
 */
export function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  if (!parsedA || !parsedB) {
    return 0;
  }

  if (parsedA.major !== parsedB.major) {
    return parsedA.major - parsedB.major;
  }

  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor - parsedB.minor;
  }

  return parsedA.patch - parsedB.patch;
}

/**
 * Find the highest compatible version from a list of versions
 */
export function findHighestCompatibleVersion(
  versions: string[],
  target: string = PJ_TARGET_VERSION
): string | null {
  const compatible = versions.filter((v) => isVersionCompatible(v, target));

  if (compatible.length === 0) {
    return null;
  }

  // Sort descending and return the highest
  compatible.sort((a, b) => compareVersions(b, a));
  return compatible[0] ?? null;
}
