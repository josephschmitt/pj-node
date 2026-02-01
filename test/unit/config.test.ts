import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  expandPath,
  expandConfigPaths,
} from "../../src/api/config.js";
import * as os from "node:os";
import * as path from "node:path";

describe("Configuration", () => {
  describe("DEFAULT_CONFIG", () => {
    it("should have default paths", () => {
      expect(DEFAULT_CONFIG.paths).toBeInstanceOf(Array);
      expect(DEFAULT_CONFIG.paths.length).toBeGreaterThan(0);
    });

    it("should have default markers", () => {
      expect(DEFAULT_CONFIG.markers).toContain(".git");
      expect(DEFAULT_CONFIG.markers).toContain("package.json");
    });

    it("should have default excludes", () => {
      expect(DEFAULT_CONFIG.exclude).toContain("node_modules");
    });

    it("should have default maxDepth", () => {
      expect(DEFAULT_CONFIG.maxDepth).toBe(3);
    });
  });

  describe("expandPath", () => {
    it("should expand ~ to home directory", () => {
      const expanded = expandPath("~/projects");
      expect(expanded).toBe(path.join(os.homedir(), "projects"));
    });

    it("should expand bare ~ to home directory", () => {
      const expanded = expandPath("~");
      expect(expanded).toBe(os.homedir());
    });

    it("should not modify absolute paths", () => {
      const absolutePath = "/usr/local/bin";
      expect(expandPath(absolutePath)).toBe(absolutePath);
    });

    it("should not modify relative paths without ~", () => {
      const relativePath = "some/path";
      expect(expandPath(relativePath)).toBe(relativePath);
    });
  });

  describe("expandConfigPaths", () => {
    it("should expand all paths in config", () => {
      const config = {
        ...DEFAULT_CONFIG,
        paths: ["~/projects", "~/code"],
      };

      const expanded = expandConfigPaths(config);

      expect(expanded.paths[0]).toBe(path.join(os.homedir(), "projects"));
      expect(expanded.paths[1]).toBe(path.join(os.homedir(), "code"));
    });

    it("should preserve other config options", () => {
      const config = {
        ...DEFAULT_CONFIG,
        maxDepth: 5,
      };

      const expanded = expandConfigPaths(config);

      expect(expanded.maxDepth).toBe(5);
      expect(expanded.markers).toEqual(DEFAULT_CONFIG.markers);
    });
  });
});
