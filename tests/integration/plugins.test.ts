import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { stat, readFile } from "fs/promises";
import { makeRoot, cleanRoot } from "../helpers/fixtures.js";
import { spawnServer, type TestServer } from "../helpers/server.js";
import { assertBundleConsistent, assertPluginInBundle, assertPluginAbsentFromBundle } from "../helpers/assert.js";

const PLUGIN_CONTENT = `export function activate() {}`;
const PLUGIN_MANIFEST = { version: "1.0.0", description: "test plugin" };

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

describe("add_plugin", () => {
  test("creates files on disk and updates bundle", async () => {
    await srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST });
    expect(await stat(join(srv.root, "plugins/my-plugin/index.ts"))).toBeTruthy();
    expect(await stat(join(srv.root, "plugins/my-plugin/manifest.json"))).toBeTruthy();
    await assertPluginInBundle(srv, "my-plugin");
    await assertBundleConsistent(srv);
  });

  test("manifest.json has correct fields", async () => {
    await srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST });
    const manifest = JSON.parse(await readFile(join(srv.root, "plugins/my-plugin/manifest.json"), "utf8"));
    expect(manifest.name).toBe("my-plugin");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.entry).toBe("index.ts");
    expect(manifest.enabled).toBe(true);
  });

  test("writes additional files under src/", async () => {
    await srv.call("add_plugin", {
      name: "my-plugin",
      content: PLUGIN_CONTENT,
      manifest: PLUGIN_MANIFEST,
      files: { "utils.ts": "export const util = () => {}" },
    });
    expect(await stat(join(srv.root, "plugins/my-plugin/src/utils.ts"))).toBeTruthy();
  });

  test("returns error on duplicate", async () => {
    await srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST });
    await expect(srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST })).rejects.toThrow();
  });
});

describe("get_plugin", () => {
  test("returns full definition", async () => {
    await srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST });
    const result = JSON.parse(await srv.call("get_plugin", { name: "my-plugin" }));
    expect(result.name).toBe("my-plugin");
    expect(result.manifest.version).toBe("1.0.0");
    expect(result.content).toBe(PLUGIN_CONTENT);
  });

  test("errors on unknown plugin", async () => {
    await expect(srv.call("get_plugin", { name: "ghost" })).rejects.toThrow();
  });
});

describe("update_plugin", () => {
  test("deep-merges manifest, preserving untouched fields", async () => {
    await srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST });
    await srv.call("update_plugin", { name: "my-plugin", manifest: { version: "2.0.0" } });
    const manifest = JSON.parse(await readFile(join(srv.root, "plugins/my-plugin/manifest.json"), "utf8"));
    expect(manifest.version).toBe("2.0.0");
    expect(manifest.description).toBe("test plugin"); // preserved
    expect(manifest.entry).toBe("index.ts"); // preserved
    await assertBundleConsistent(srv);
  });

  test("bundle reflects updated version", async () => {
    await srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST });
    await srv.call("update_plugin", { name: "my-plugin", manifest: { version: "3.0.0" } });
    const { readBundleFromDisk } = await import("../helpers/assert.js");
    const bundle = await readBundleFromDisk(srv.root);
    expect(bundle.plugins.find(p => p.name === "my-plugin")?.version).toBe("3.0.0");
  });
});

describe("enable_plugin / disable_plugin", () => {
  test("disabling sets enabled=false in manifest and bundle", async () => {
    await srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST });
    await srv.call("disable_plugin", { name: "my-plugin" });
    const manifest = JSON.parse(await readFile(join(srv.root, "plugins/my-plugin/manifest.json"), "utf8"));
    expect(manifest.enabled).toBe(false);
    const { readBundleFromDisk } = await import("../helpers/assert.js");
    const bundle = await readBundleFromDisk(srv.root);
    expect(bundle.plugins.find(p => p.name === "my-plugin")?.enabled).toBe(false);
    await assertBundleConsistent(srv);
  });

  test("disabled plugin still appears in bundle", async () => {
    await srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST });
    await srv.call("disable_plugin", { name: "my-plugin" });
    await assertPluginInBundle(srv, "my-plugin");
  });

  test("re-enabling sets enabled=true", async () => {
    await srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST });
    await srv.call("disable_plugin", { name: "my-plugin" });
    await srv.call("enable_plugin", { name: "my-plugin" });
    const manifest = JSON.parse(await readFile(join(srv.root, "plugins/my-plugin/manifest.json"), "utf8"));
    expect(manifest.enabled).toBe(true);
    await assertBundleConsistent(srv);
  });
});

describe("remove_plugin", () => {
  test("deletes directory and removes from bundle", async () => {
    await srv.call("add_plugin", { name: "my-plugin", content: PLUGIN_CONTENT, manifest: PLUGIN_MANIFEST });
    await srv.call("remove_plugin", { name: "my-plugin" });
    await expect(stat(join(srv.root, "plugins/my-plugin"))).rejects.toThrow();
    await assertPluginAbsentFromBundle(srv, "my-plugin");
    await assertBundleConsistent(srv);
  });
});
