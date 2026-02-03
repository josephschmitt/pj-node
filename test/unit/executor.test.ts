import { describe, it, expect } from "vitest";
import { buildArgs, parseJsonOutput } from "../../src/cli/executor.js";

describe("CLI Executor", () => {
  describe("buildArgs", () => {
    it("should return --json by default", () => {
      const args = buildArgs();
      expect(args).toContain("--json");
    });

    it("should add --path flags for paths", () => {
      const args = buildArgs({ paths: ["/foo", "/bar"] });
      expect(args).toContain("--path");
      expect(args).toContain("/foo");
      expect(args).toContain("/bar");
    });

    it("should add --marker flags for markers", () => {
      const args = buildArgs({ markers: [".git", "package.json"] });
      expect(args).toContain("--marker");
      expect(args).toContain(".git");
      expect(args).toContain("package.json");
    });

    it("should add --exclude flags for excludes", () => {
      const args = buildArgs({ excludes: ["node_modules"] });
      expect(args).toContain("--exclude");
      expect(args).toContain("node_modules");
    });

    it("should add --max-depth flag", () => {
      const args = buildArgs({ maxDepth: 5 });
      expect(args).toContain("--max-depth");
      expect(args).toContain("5");
    });

    it("should add --no-ignore flag when set", () => {
      const args = buildArgs({ noIgnore: true });
      expect(args).toContain("--no-ignore");
    });

    it("should add --no-nested flag when nested is false", () => {
      const args = buildArgs({ nested: false });
      expect(args).toContain("--no-nested");
    });

    it("should add --no-cache flag when set", () => {
      const args = buildArgs({ noCache: true });
      expect(args).toContain("--no-cache");
    });

    it("should add --icons flag when set", () => {
      const args = buildArgs({ icons: true });
      expect(args).toContain("--icons");
    });

    it("should add --config flag when configPath is set", () => {
      const args = buildArgs({ configPath: "/custom/config.yaml" });
      expect(args).toContain("--config");
      expect(args).toContain("/custom/config.yaml");
    });

    it("should add --verbose flag when set", () => {
      const args = buildArgs({ verbose: true });
      expect(args).toContain("--verbose");
    });
  });

  describe("parseJsonOutput", () => {
    it("should parse wrapped JSON output format", () => {
      const output = JSON.stringify({
        projects: [
          { path: "/foo/bar", name: "bar", marker: ".git" },
          { path: "/foo/baz", name: "baz", marker: "package.json", icon: " " },
        ],
      });

      const projects = parseJsonOutput(output);

      expect(projects).toHaveLength(2);
      expect(projects[0]).toEqual({
        path: "/foo/bar",
        name: "bar",
        marker: ".git",
        icon: undefined,
        priority: undefined,
      });
      expect(projects[1]).toEqual({
        path: "/foo/baz",
        name: "baz",
        marker: "package.json",
        icon: " ",
        priority: undefined,
      });
    });

    it("should parse direct array format for backwards compatibility", () => {
      const output = JSON.stringify([
        { path: "/foo/bar", name: "bar", marker: ".git" },
        { path: "/foo/baz", name: "baz", marker: "package.json", icon: " " },
      ]);

      const projects = parseJsonOutput(output);

      expect(projects).toHaveLength(2);
      expect(projects[0]).toEqual({
        path: "/foo/bar",
        name: "bar",
        marker: ".git",
        icon: undefined,
        priority: undefined,
      });
    });

    it("should return empty array for empty output", () => {
      expect(parseJsonOutput("")).toEqual([]);
      expect(parseJsonOutput("   ")).toEqual([]);
    });

    it("should throw on invalid JSON", () => {
      expect(() => parseJsonOutput("not json")).toThrow("Failed to parse pj output");
    });

    it("should throw on unexpected format (not array or wrapped object)", () => {
      expect(() => parseJsonOutput(JSON.stringify({ invalid: "format" }))).toThrow(
        "Unexpected pj output format"
      );
    });

    it("should throw on non-object content", () => {
      expect(() => parseJsonOutput(JSON.stringify("string"))).toThrow(
        "Unexpected pj output format"
      );
    });
  });
});
