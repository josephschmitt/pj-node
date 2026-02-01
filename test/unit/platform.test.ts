import { describe, it, expect } from "vitest";
import {
  detectPlatform,
  getAssetFilename,
  isPlatformSupported,
} from "../../src/binary/platform.js";

describe("Platform Detection", () => {
  it("should detect the current platform", () => {
    const platform = detectPlatform();

    expect(platform).toHaveProperty("os");
    expect(platform).toHaveProperty("arch");
    expect(platform).toHaveProperty("pjOs");
    expect(platform).toHaveProperty("pjArch");

    expect(["darwin", "linux", "win32"]).toContain(platform.os);
    expect(["x64", "arm64"]).toContain(platform.arch);
    expect(["darwin", "linux", "windows"]).toContain(platform.pjOs);
    expect(["amd64", "arm64"]).toContain(platform.pjArch);
  });

  it("should return true for isPlatformSupported on supported platforms", () => {
    expect(isPlatformSupported()).toBe(true);
  });

  it("should generate correct asset filename", () => {
    const filename = getAssetFilename("1.4.1", {
      os: "darwin",
      arch: "arm64",
      pjOs: "darwin",
      pjArch: "arm64",
    });
    expect(filename).toBe("pj_1.4.1_darwin_arm64.tar.gz");
  });

  it("should handle version with v prefix", () => {
    const filename = getAssetFilename("v1.4.1", {
      os: "linux",
      arch: "x64",
      pjOs: "linux",
      pjArch: "amd64",
    });
    expect(filename).toBe("pj_1.4.1_linux_amd64.tar.gz");
  });

  it("should generate correct filename for Windows", () => {
    const filename = getAssetFilename("2.0.0", {
      os: "win32",
      arch: "x64",
      pjOs: "windows",
      pjArch: "amd64",
    });
    expect(filename).toBe("pj_2.0.0_windows_amd64.tar.gz");
  });
});
