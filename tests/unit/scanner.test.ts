import { describe, test, expect, beforeAll } from "bun:test";
import { FIXTURES_ROOT } from "../helpers/fixtures.js";
import { scanTools, scanCommands, scanPlugins, readTool, readCommand, readPlugin } from "../../src/scanner.js";

beforeAll(() => {
  process.env.ROSETTA_ROOT = FIXTURES_ROOT;
});

describe("scanTools", () => {
  test("returns valid tools", async () => {
    const tools = await scanTools(FIXTURES_ROOT);
    expect(tools.map(t => t.name)).toContain("valid-tool");
    expect(tools.map(t => t.name)).toContain("valid-tool-no-schema");
  });

  test("excludes directories missing index.ts", async () => {
    const tools = await scanTools(FIXTURES_ROOT);
    expect(tools.map(t => t.name)).not.toContain("invalid-tool-no-entry");
  });
});

describe("readTool", () => {
  test("returns content, description, and schema when all files present", async () => {
    const tool = await readTool("valid-tool", FIXTURES_ROOT);
    expect(tool.content).toBeTruthy();
    expect(tool.description).toContain("Uppercases");
    expect(tool.schema?.input).toBeDefined();
    expect(tool.schema?.output).toBeDefined();
  });

  test("returns no schema when schema.json absent", async () => {
    const tool = await readTool("valid-tool-no-schema", FIXTURES_ROOT);
    expect(tool.schema).toBeUndefined();
  });

  test("throws when index.ts missing", async () => {
    await expect(readTool("invalid-tool-no-entry", FIXTURES_ROOT)).rejects.toThrow();
  });
});

describe("scanCommands", () => {
  test("returns valid commands", async () => {
    const commands = await scanCommands(FIXTURES_ROOT);
    expect(commands.map(c => c.name)).toContain("valid-command");
  });
});

describe("readCommand", () => {
  test("returns content, description, and schema", async () => {
    const cmd = await readCommand("valid-command", FIXTURES_ROOT);
    expect(cmd.content).toBeTruthy();
    expect(cmd.description).toBeTruthy();
    expect(cmd.schema).toBeDefined();
  });
});

describe("scanPlugins", () => {
  test("returns valid plugins", async () => {
    const plugins = await scanPlugins(FIXTURES_ROOT);
    expect(plugins.map(p => p.name)).toContain("valid-plugin");
  });

  test("excludes plugins missing manifest.json", async () => {
    const plugins = await scanPlugins(FIXTURES_ROOT);
    expect(plugins.map(p => p.name)).not.toContain("invalid-plugin-no-manifest");
  });
});

describe("readPlugin", () => {
  test("returns manifest, content, and files", async () => {
    const plugin = await readPlugin("valid-plugin", FIXTURES_ROOT);
    expect(plugin.manifest.version).toBe("1.0.0");
    expect(plugin.content).toBeTruthy();
    expect(plugin.files.length).toBeGreaterThan(0);
  });

  test("throws when manifest.json missing", async () => {
    await expect(readPlugin("invalid-plugin-no-manifest", FIXTURES_ROOT)).rejects.toThrow();
  });
});
