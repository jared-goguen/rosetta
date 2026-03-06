import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { stat } from "fs/promises";
import { makeRoot, cleanRoot } from "../helpers/fixtures.js";
import { spawnServer, type TestServer } from "../helpers/server.js";
import { assertBundleConsistent, assertToolInBundle, assertToolAbsentFromBundle } from "../helpers/assert.js";

const TOOL_CONTENT = `export function run(input: { value: string }) { return { result: input.value }; }`;
const TOOL_SCHEMA = { input: { type: "object", properties: { value: { type: "string" } } }, output: { type: "object" } };

let srv: TestServer;

beforeEach(async () => {
  const root = await makeRoot();
  srv = await spawnServer(root);
});

afterEach(async () => {
  const root = srv.root;
  await srv.close();
  await cleanRoot(root);
});

describe("add_tool", () => {
  test("creates files on disk and updates bundle", async () => {
    await srv.call("add_tool", { name: "my-tool", content: TOOL_CONTENT, description: "a tool", schema: TOOL_SCHEMA });

    expect(await stat(join(srv.root, "tools/my-tool/index.ts"))).toBeTruthy();
    expect(await stat(join(srv.root, "tools/my-tool/purpose.md"))).toBeTruthy();
    expect(await stat(join(srv.root, "tools/my-tool/schema.json"))).toBeTruthy();

    await assertToolInBundle(srv, "my-tool");
    await assertBundleConsistent(srv);
  });

  test("bundle contains correct schema after add", async () => {
    await srv.call("add_tool", { name: "my-tool", content: TOOL_CONTENT, schema: TOOL_SCHEMA });
    const { readBundleFromDisk } = await import("../helpers/assert.js");
    const bundle = await readBundleFromDisk(srv.root);
    const tool = bundle.tools.find(t => t.name === "my-tool");
    expect(tool?.schema).toMatchObject(TOOL_SCHEMA);
  });

  test("returns error on duplicate name without touching bundle", async () => {
    await srv.call("add_tool", { name: "my-tool", content: TOOL_CONTENT });
    await expect(srv.call("add_tool", { name: "my-tool", content: TOOL_CONTENT })).rejects.toThrow();
    const { readBundleFromDisk } = await import("../helpers/assert.js");
    const bundle = await readBundleFromDisk(srv.root);
    expect(bundle.tools.filter(t => t.name === "my-tool")).toHaveLength(1);
  });

  test("works without optional description and schema", async () => {
    await srv.call("add_tool", { name: "bare-tool", content: TOOL_CONTENT });
    await assertToolInBundle(srv, "bare-tool");
    await assertBundleConsistent(srv);
  });
});

describe("get_tool", () => {
  test("returns full tool definition", async () => {
    await srv.call("add_tool", { name: "my-tool", content: TOOL_CONTENT, description: "desc" });
    const result = JSON.parse(await srv.call("get_tool", { name: "my-tool" }));
    expect(result.name).toBe("my-tool");
    expect(result.content).toBe(TOOL_CONTENT);
    expect(result.description).toBe("desc");
  });

  test("returns error for unknown tool", async () => {
    await expect(srv.call("get_tool", { name: "nonexistent" })).rejects.toThrow();
  });
});

describe("update_tool", () => {
  test("updates content only, leaving schema intact", async () => {
    await srv.call("add_tool", { name: "my-tool", content: TOOL_CONTENT, schema: TOOL_SCHEMA });
    await srv.call("update_tool", { name: "my-tool", content: "export function run() { return {}; }" });
    const result = JSON.parse(await srv.call("get_tool", { name: "my-tool" }));
    expect(result.content).toBe("export function run() { return {}; }");
    expect(result.schema).toBeDefined();
    await assertBundleConsistent(srv);
  });

  test("updates schema, bundle reflects new schema", async () => {
    await srv.call("add_tool", { name: "my-tool", content: TOOL_CONTENT, schema: TOOL_SCHEMA });
    const newSchema = { input: { type: "object", properties: { x: { type: "number" } } }, output: { type: "boolean" } };
    await srv.call("update_tool", { name: "my-tool", schema: newSchema });
    const { readBundleFromDisk } = await import("../helpers/assert.js");
    const bundle = await readBundleFromDisk(srv.root);
    const tool = bundle.tools.find(t => t.name === "my-tool");
    expect(tool?.schema?.output).toMatchObject({ type: "boolean" });
    await assertBundleConsistent(srv);
  });

  test("returns error for unknown tool", async () => {
    await expect(srv.call("update_tool", { name: "ghost", content: "x" })).rejects.toThrow();
  });
});

describe("remove_tool", () => {
  test("deletes directory and removes from bundle", async () => {
    await srv.call("add_tool", { name: "my-tool", content: TOOL_CONTENT });
    await srv.call("remove_tool", { name: "my-tool" });
    await expect(stat(join(srv.root, "tools/my-tool"))).rejects.toThrow();
    await assertToolAbsentFromBundle(srv, "my-tool");
    await assertBundleConsistent(srv);
  });

  test("returns error for unknown tool", async () => {
    await expect(srv.call("remove_tool", { name: "ghost" })).rejects.toThrow();
  });
});

describe("list_tools", () => {
  test("returns all tools and no more", async () => {
    await srv.call("add_tool", { name: "tool-a", content: TOOL_CONTENT });
    await srv.call("add_tool", { name: "tool-b", content: TOOL_CONTENT });
    const result = JSON.parse(await srv.call("list_tools"));
    expect(result.map((t: any) => t.name)).toContain("tool-a");
    expect(result.map((t: any) => t.name)).toContain("tool-b");
    expect(result).toHaveLength(2);
  });
});

describe("multi-step sequence", () => {
  test("add → update → remove keeps bundle accurate at each step", async () => {
    await srv.call("add_tool", { name: "seq-tool", content: TOOL_CONTENT });
    await assertToolInBundle(srv, "seq-tool");
    await assertBundleConsistent(srv);

    await srv.call("update_tool", { name: "seq-tool", description: "updated" });
    await assertToolInBundle(srv, "seq-tool");
    await assertBundleConsistent(srv);

    await srv.call("remove_tool", { name: "seq-tool" });
    await assertToolAbsentFromBundle(srv, "seq-tool");
    await assertBundleConsistent(srv);
  });
});
