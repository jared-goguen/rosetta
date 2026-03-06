import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { stat } from "fs/promises";
import { makeRoot, cleanRoot } from "../helpers/fixtures.js";
import { spawnServer, type TestServer } from "../helpers/server.js";
import { assertBundleConsistent, assertCommandInBundle } from "../helpers/assert.js";

const CMD_CONTENT = `export function run(args: Record<string, unknown>) { return args; }`;
const CMD_SCHEMA = { type: "object", properties: { target: { type: "string" } } };

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

describe("add_command", () => {
  test("creates files on disk and updates bundle", async () => {
    await srv.call("add_command", { name: "deploy", content: CMD_CONTENT, description: "deploys things", schema: CMD_SCHEMA });
    expect(await stat(join(srv.root, "commands/deploy/index.ts"))).toBeTruthy();
    await assertCommandInBundle(srv, "deploy");
    await assertBundleConsistent(srv);
  });

  test("returns error on duplicate", async () => {
    await srv.call("add_command", { name: "deploy", content: CMD_CONTENT });
    await expect(srv.call("add_command", { name: "deploy", content: CMD_CONTENT })).rejects.toThrow();
  });
});

describe("get_command", () => {
  test("returns full definition", async () => {
    await srv.call("add_command", { name: "deploy", content: CMD_CONTENT, description: "deploys" });
    const result = JSON.parse(await srv.call("get_command", { name: "deploy" }));
    expect(result.name).toBe("deploy");
    expect(result.content).toBe(CMD_CONTENT);
    expect(result.description).toBe("deploys");
  });

  test("errors on unknown command", async () => {
    await expect(srv.call("get_command", { name: "ghost" })).rejects.toThrow();
  });
});

describe("update_command", () => {
  test("updates description, bundle reflects change", async () => {
    await srv.call("add_command", { name: "deploy", content: CMD_CONTENT });
    await srv.call("update_command", { name: "deploy", description: "new desc" });
    const { readBundleFromDisk } = await import("../helpers/assert.js");
    const bundle = await readBundleFromDisk(srv.root);
    const cmd = bundle.commands.find(c => c.name === "deploy");
    expect(cmd?.description).toBe("new desc");
    await assertBundleConsistent(srv);
  });
});

describe("remove_command", () => {
  test("deletes directory and removes from bundle", async () => {
    await srv.call("add_command", { name: "deploy", content: CMD_CONTENT });
    await srv.call("remove_command", { name: "deploy" });
    await expect(stat(join(srv.root, "commands/deploy"))).rejects.toThrow();
    const { readBundleFromDisk } = await import("../helpers/assert.js");
    const bundle = await readBundleFromDisk(srv.root);
    expect(bundle.commands.find(c => c.name === "deploy")).toBeUndefined();
    await assertBundleConsistent(srv);
  });
});

describe("list_commands", () => {
  test("returns all commands", async () => {
    await srv.call("add_command", { name: "cmd-a", content: CMD_CONTENT });
    await srv.call("add_command", { name: "cmd-b", content: CMD_CONTENT });
    const result = JSON.parse(await srv.call("list_commands"));
    expect(result.map((c: any) => c.name)).toContain("cmd-a");
    expect(result.map((c: any) => c.name)).toContain("cmd-b");
  });
});
