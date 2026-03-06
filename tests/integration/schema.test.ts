import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { makeRoot, cleanRoot } from "../helpers/fixtures.js";
import { spawnServer, type TestServer } from "../helpers/server.js";
import { assertBundleConsistent, readBundleFromDisk } from "../helpers/assert.js";
import type { RosettaSchema } from "../../src/types.js";

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

describe("get_schema", () => {
  test("returns empty bundle with correct shape on empty root", async () => {
    const schema: RosettaSchema = JSON.parse(await srv.call("get_schema"));
    expect(schema.tools).toEqual([]);
    expect(schema.commands).toEqual([]);
    expect(schema.plugins).toEqual([]);
    expect(schema.version).toBe("1");
    expect(new Date(schema.generatedAt).getTime()).not.toBeNaN();
    await assertBundleConsistent(srv);
  });

  test("reflects multiple artifact types in a single bundle", async () => {
    await srv.call("add_tool", { name: "t1", content: "x", schema: { input: {}, output: {} } });
    await srv.call("add_command", { name: "c1", content: "x" });
    await srv.call("add_plugin", { name: "p1", content: "x", manifest: { version: "1.0.0" } });
    await assertBundleConsistent(srv);
    const bundle = await readBundleFromDisk(srv.root);
    expect(bundle.tools).toHaveLength(1);
    expect(bundle.commands).toHaveLength(1);
    expect(bundle.plugins).toHaveLength(1);
  });

  test("bundle on disk matches get_schema after a series of mutations", async () => {
    await srv.call("add_tool", { name: "t1", content: "x" });
    await srv.call("add_tool", { name: "t2", content: "x" });
    await srv.call("remove_tool", { name: "t1" });
    await srv.call("add_command", { name: "c1", content: "x" });
    await assertBundleConsistent(srv);
  });
});

describe("validate", () => {
  test("returns valid after add_tool with schema", async () => {
    await srv.call("add_tool", { name: "t1", content: "export function run() {}", schema: { input: { type: "object" }, output: { type: "object" } } });
    const result = JSON.parse(await srv.call("validate", { type: "tool", name: "t1" }));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("returns valid after add_plugin", async () => {
    await srv.call("add_plugin", { name: "p1", content: "export function activate() {}", manifest: { version: "1.0.0" } });
    const result = JSON.parse(await srv.call("validate", { type: "plugin", name: "p1" }));
    expect(result.valid).toBe(true);
  });

  test("returns invalid for nonexistent artifact", async () => {
    const result = JSON.parse(await srv.call("validate", { type: "tool", name: "ghost" }));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
