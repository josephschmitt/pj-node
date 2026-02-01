#!/usr/bin/env node

/**
 * Post-install script for @joe-sh/pj
 *
 * This script attempts to pre-download the pj binary during package installation.
 * If the download fails, the package will still work - the binary will be
 * downloaded on first use instead.
 */

// Skip in CI environments unless explicitly enabled
if (process.env.CI && !process.env.PJ_INSTALL_BINARY) {
  console.log("@joe-sh/pj: Skipping binary download in CI environment");
  process.exit(0);
}

// Skip if PJ_SKIP_INSTALL is set
if (process.env.PJ_SKIP_INSTALL) {
  console.log("@joe-sh/pj: Skipping binary download (PJ_SKIP_INSTALL is set)");
  process.exit(0);
}

async function main() {
  try {
    // Dynamic import to handle the case where dist doesn't exist yet
    const { getBinaryManager } = await import("../dist/index.js");
    const manager = getBinaryManager();

    // Check if binary is already available
    const status = await manager.getStatus();
    if (status.available) {
      console.log(
        `@joe-sh/pj: Using existing pj binary (v${status.version}) from ${status.source}`
      );
      return;
    }

    console.log("@joe-sh/pj: Downloading pj binary...");
    const binaryPath = await manager.getBinaryPath({
      onProgress: (progress) => {
        if (progress.percent !== undefined) {
          process.stdout.write(`\r@joe-sh/pj: Downloading... ${progress.percent}%`);
        }
      },
    });

    const newStatus = await manager.getStatus();
    console.log(`\n@joe-sh/pj: Successfully installed pj v${newStatus.version}`);
    console.log(`@joe-sh/pj: Binary location: ${binaryPath}`);
  } catch (error) {
    // Don't fail installation if binary download fails
    // The binary will be downloaded on first use
    console.warn(
      `\n@joe-sh/pj: Warning - Could not pre-download binary: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    console.warn("@joe-sh/pj: The binary will be downloaded on first use");
  }
}

main();
