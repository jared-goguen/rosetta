import { describe, test, expect } from "bun:test";
import { FIXTURES_ROOT } from "../helpers/fixtures.js";
import { validateTool, validateCommand, validatePlugin } from "../../src/validator.js";

describe("validateTool", () => {
  test("valid for a well-formed tool with schema", async () => {
    const result = await validateTool("valid-tool", FIXTURES_ROOT);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("valid for a tool without schema.json", async () => {
    const result = await validateTool("valid-tool-no-schema", FIXTURES_ROOT);
    expect(result.valid).toBe(true);
  });

  test("invalid when index.ts missing", async () => {
    const result = await validateTool("invalid-tool-no-entry", FIXTURES_ROOT);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("index.ts"))).toBe(true);
  });

  test("invalid when schema.json has wrong shape", async () => {
    const result = await validateTool("invalid-tool-bad-schema", FIXTURES_ROOT);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("invalid when tool directory does not exist", async () => {
    const result = await validateTool("nonexistent", FIXTURES_ROOT);
    expect(result.valid).toBe(false);
  });
});

describe("validateCommand", () => {
  test("valid for a well-formed command", async () => {
    const result = await validateCommand("valid-command", FIXTURES_ROOT);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("validatePlugin", () => {
  test("valid for a well-formed plugin", async () => {
    const result = await validatePlugin("valid-plugin", FIXTURES_ROOT);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("invalid when manifest.json missing", async () => {
    const result = await validatePlugin("invalid-plugin-no-manifest", FIXTURES_ROOT);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("manifest.json"))).toBe(true);
  });

  test("invalid when manifest missing required fields", async () => {
    const result = await validatePlugin("invalid-plugin-bad-manifest", FIXTURES_ROOT);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("version"))).toBe(true);
  });
});
