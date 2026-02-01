import type { Platform } from "../api/types.js";
import { PjBinaryError } from "../api/types.js";

/**
 * Detect the current platform and return normalized platform info
 */
export function detectPlatform(): Platform {
  const nodeOs = process.platform;
  const nodeArch = process.arch;

  // Map Node.js platform to pj asset names
  let os: Platform["os"];
  let pjOs: Platform["pjOs"];

  switch (nodeOs) {
    case "darwin":
      os = "darwin";
      pjOs = "darwin";
      break;
    case "linux":
      os = "linux";
      pjOs = "linux";
      break;
    case "win32":
      os = "win32";
      pjOs = "windows";
      break;
    default:
      throw new PjBinaryError(`Unsupported operating system: ${nodeOs}`);
  }

  // Map Node.js architecture to pj asset names
  let arch: Platform["arch"];
  let pjArch: Platform["pjArch"];

  switch (nodeArch) {
    case "x64":
      arch = "x64";
      pjArch = "amd64";
      break;
    case "arm64":
      arch = "arm64";
      pjArch = "arm64";
      break;
    default:
      throw new PjBinaryError(`Unsupported architecture: ${nodeArch}`);
  }

  return { os, arch, pjOs, pjArch };
}

/**
 * Get the expected asset filename for the current platform
 */
export function getAssetFilename(version: string, platform?: Platform): string {
  const p = platform ?? detectPlatform();
  const versionWithoutV = version.startsWith("v") ? version.slice(1) : version;

  return `pj_${versionWithoutV}_${p.pjOs}_${p.pjArch}.tar.gz`;
}

/**
 * Check if the current platform is supported
 */
export function isPlatformSupported(): boolean {
  try {
    detectPlatform();
    return true;
  } catch {
    return false;
  }
}
