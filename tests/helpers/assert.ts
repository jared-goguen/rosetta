import { join } from "path";
import { readFile } from "fs/promises";
import { expect } from "bun:test";
import type { TestServer } from "./server.js";
import type { RosettaSchema } from "../../src/types.js";

export async function readBundleFromDisk(root: string): Promise<RosettaSchema> {
  const text = await readFile(join(root, "rosetta.schema.json"), "utf8");
  return JSON.parse(text);
}

export async function assertBundleConsistent(srv: TestServer): Promise<void> {
  const fromDisk = await readBundleFromDisk(srv.root);
  const fromServer = JSON.parse(await srv.call("get_schema"));
  // generatedAt will differ — compare everything except that field
  const { generatedAt: _a, ...diskRest } = fromDisk;
  const { generatedAt: _b, ...serverRest } = fromServer;
  expect(diskRest).toEqual(serverRest);
}

export async function assertToolInBundle(srv: TestServer, name: string): Promise<void> {
  const bundle = await readBundleFromDisk(srv.root);
  const found = bundle.tools.find(t => t.name === name);
  expect(found).toBeDefined();
}

export async function assertToolAbsentFromBundle(srv: TestServer, name: string): Promise<void> {
  const bundle = await readBundleFromDisk(srv.root);
  const found = bundle.tools.find(t => t.name === name);
  expect(found).toBeUndefined();
}

export async function assertCommandInBundle(srv: TestServer, name: string): Promise<void> {
  const bundle = await readBundleFromDisk(srv.root);
  expect(bundle.commands.find(c => c.name === name)).toBeDefined();
}

export async function assertPluginInBundle(srv: TestServer, name: string): Promise<void> {
  const bundle = await readBundleFromDisk(srv.root);
  expect(bundle.plugins.find(p => p.name === name)).toBeDefined();
}

export async function assertPluginAbsentFromBundle(srv: TestServer, name: string): Promise<void> {
  const bundle = await readBundleFromDisk(srv.root);
  expect(bundle.plugins.find(p => p.name === name)).toBeUndefined();
}
