import { describe, it, expect } from "vitest";
import {
  parseVersion,
  parseTargetVersion,
  isVersionCompatible,
  compareVersions,
  findHighestCompatibleVersion,
} from "../../src/binary/version.js";

describe("Version Utilities", () => {
  describe("parseVersion", () => {
    it("should parse a standard version string", () => {
      const result = parseVersion("1.4.1");
      expect(result).toEqual({
        major: 1,
        minor: 4,
        patch: 1,
        raw: "1.4.1",
      });
    });

    it("should parse a version with v prefix", () => {
      const result = parseVersion("v2.0.5");
      expect(result).toEqual({
        major: 2,
        minor: 0,
        patch: 5,
        raw: "2.0.5",
      });
    });

    it("should parse version 0.x.x", () => {
      const result = parseVersion("0.1.0");
      expect(result).toEqual({
        major: 0,
        minor: 1,
        patch: 0,
        raw: "0.1.0",
      });
    });

    it("should return null for invalid version", () => {
      expect(parseVersion("invalid")).toBeNull();
      expect(parseVersion("1.4")).toBeNull();
      expect(parseVersion("")).toBeNull();
    });
  });

  describe("parseTargetVersion", () => {
    it("should parse a major.minor target", () => {
      const result = parseTargetVersion("1.4");
      expect(result).toEqual({
        major: 1,
        minor: 4,
      });
    });

    it("should return null for invalid targets", () => {
      expect(parseTargetVersion("1.4.1")).toBeNull();
      expect(parseTargetVersion("v1.4")).toBeNull();
      expect(parseTargetVersion("1")).toBeNull();
      expect(parseTargetVersion("")).toBeNull();
    });
  });

  describe("isVersionCompatible", () => {
    it("should return true for matching major.minor", () => {
      expect(isVersionCompatible("1.4.0", "1.4")).toBe(true);
      expect(isVersionCompatible("1.4.1", "1.4")).toBe(true);
      expect(isVersionCompatible("1.4.99", "1.4")).toBe(true);
      expect(isVersionCompatible("v1.4.5", "1.4")).toBe(true);
    });

    it("should return false for different minor version", () => {
      expect(isVersionCompatible("1.3.0", "1.4")).toBe(false);
      expect(isVersionCompatible("1.5.0", "1.4")).toBe(false);
    });

    it("should return false for different major version", () => {
      expect(isVersionCompatible("2.4.0", "1.4")).toBe(false);
      expect(isVersionCompatible("0.4.0", "1.4")).toBe(false);
    });

    it("should return false for invalid versions", () => {
      expect(isVersionCompatible("invalid", "1.4")).toBe(false);
      expect(isVersionCompatible("1.4.0", "invalid")).toBe(false);
    });
  });

  describe("compareVersions", () => {
    it("should return negative when a < b", () => {
      expect(compareVersions("1.4.0", "1.4.1")).toBeLessThan(0);
      expect(compareVersions("1.3.0", "1.4.0")).toBeLessThan(0);
      expect(compareVersions("0.9.0", "1.0.0")).toBeLessThan(0);
    });

    it("should return positive when a > b", () => {
      expect(compareVersions("1.4.1", "1.4.0")).toBeGreaterThan(0);
      expect(compareVersions("1.5.0", "1.4.9")).toBeGreaterThan(0);
      expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    });

    it("should return 0 when a === b", () => {
      expect(compareVersions("1.4.1", "1.4.1")).toBe(0);
      expect(compareVersions("v1.4.1", "1.4.1")).toBe(0);
    });

    it("should return 0 for invalid versions", () => {
      expect(compareVersions("invalid", "1.4.0")).toBe(0);
      expect(compareVersions("1.4.0", "invalid")).toBe(0);
    });
  });

  describe("findHighestCompatibleVersion", () => {
    it("should find the highest compatible version", () => {
      const versions = ["1.3.0", "1.4.0", "1.4.1", "1.4.2", "1.5.0", "2.0.0"];
      expect(findHighestCompatibleVersion(versions, "1.4")).toBe("1.4.2");
    });

    it("should handle v-prefixed versions", () => {
      const versions = ["v1.4.0", "v1.4.1", "v1.4.2"];
      expect(findHighestCompatibleVersion(versions, "1.4")).toBe("v1.4.2");
    });

    it("should return null when no compatible version exists", () => {
      const versions = ["1.3.0", "1.5.0", "2.0.0"];
      expect(findHighestCompatibleVersion(versions, "1.4")).toBeNull();
    });

    it("should return null for empty array", () => {
      expect(findHighestCompatibleVersion([], "1.4")).toBeNull();
    });

    it("should handle single compatible version", () => {
      const versions = ["1.3.0", "1.4.5", "2.0.0"];
      expect(findHighestCompatibleVersion(versions, "1.4")).toBe("1.4.5");
    });
  });
});
