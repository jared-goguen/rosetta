import { describe, test, expect } from "bun:test";
import { join } from "path";
import { readFile } from "fs/promises";
import { generateBundle, writeBundle } from "../../src/bundle.js";
import { makeRoot, cleanRoot } from "../helpers/fixtures.js";
import type { ToolRecord, CommandRecord, PluginRecord } from "../../src/types.js";

const mockTool: ToolRecord = {
  name: "foo",
  path: "/x/tools/foo",
  content: "export function run() {}",
  description: "does foo",
  schema: { input: { type: "object" }, output: { type: "string" } },
};

const mockPlugin: PluginRecord = {
  name: "my-plugin",
  path: "/x/plugins/my-plugin",
  content: "export function activate() {}",
  manifest: { name: "my-plugin", version: "1.2.3", entry: "index.ts", dependencies: ["other"], enabled: true },
  files: ["index.ts", "manifest.json"],
};

describe("generateBundle", () => {
  test("maps tool records to definitions, stripping source content", () => {
    const bundle = generateBundle([mockTool], [], []);
    expect(bundle.tools[0]).toMatchObject({ name: "foo", description: "does foo" });
    expect((bundle.tools[0] as any).content).toBeUndefined();
    expect((bundle.tools[0] as any).path).toBeUndefined();
  });

  test("sets schema to null when tool has no schema", () => {
    const bare: ToolRecord = { name: "bare", path: "/x", content: "x" };
    const bundle = generateBundle([bare], [], []);
    expect(bundle.tools[0].schema).toBeNull();
  });

  test("maps plugin manifest fields correctly", () => {
    const bundle = generateBundle([], [], [mockPlugin]);
    expect(bundle.plugins[0]).toMatchObject({
      name: "my-plugin",
      version: "1.2.3",
      dependencies: ["other"],
      enabled: true,
    });
  });

  test("sets version and generatedAt", () => {
    const bundle = generateBundle([], [], []);
    expect(bundle.version).toBe("1");
    expect(new Date(bundle.generatedAt).getTime()).not.toBeNaN();
  });

  test("empty inputs produce empty arrays", () => {
    const bundle = generateBundle([], [], []);
    expect(bundle.tools).toEqual([]);
    expect(bundle.commands).toEqual([]);
    expect(bundle.plugins).toEqual([]);
  });
});

describe("writeBundle", () => {
  test("writes valid JSON to rosetta.schema.json", async () => {
    const root = await makeRoot();
    try {
      const bundle = generateBundle([mockTool], [], []);
      await writeBundle(bundle, root);
      const written = JSON.parse(await readFile(join(root, "rosetta.schema.json"), "utf8"));
      expect(written.version).toBe("1");
      expect(written.tools[0].name).toBe("foo");
    } finally {
      await cleanRoot(root);
    }
  });

  test("output is 2-space indented", async () => {
    const root = await makeRoot();
    try {
      const bundle = generateBundle([], [], []);
      await writeBundle(bundle, root);
      const raw = await readFile(join(root, "rosetta.schema.json"), "utf8");
      expect(raw).toContain("  \"version\"");
    } finally {
      await cleanRoot(root);
    }
  });
});
