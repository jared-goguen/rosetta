import { join } from "path";
import { mkdir, writeFile, readFile, rm, stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { scanPlugins, readPlugin, getRoot } from "../scanner.js";
import { rebuildBundle } from "../bundle.js";
import type { PluginManifest } from "../types.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

export async function listPlugins() {
  const plugins = await scanPlugins(getRoot());
  const result = plugins.map(p => ({
    name: p.name,
    version: p.manifest.version,
    description: p.manifest.description,
    enabled: p.manifest.enabled ?? true,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}

export async function getPlugin(input: { name: string }) {
  const root = getRoot();
  const dir = join(root, "plugins", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Plugin not found: ${input.name}`);
  const plugin = await readPlugin(input.name, root);
  return { content: [{ type: "text" as const, text: JSON.stringify(plugin) }] };
}

export async function addPlugin(input: {
  name: string;
  content: string;
  manifest: { version: string; description?: string; dependencies?: string[] };
  files?: Record<string, string>;
}) {
  const root = getRoot();
  const dir = join(root, "plugins", input.name);
  if (await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Plugin already exists: ${input.name}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.ts"), input.content, "utf8");
  const manifest: PluginManifest = {
    name: input.name,
    version: input.manifest.version,
    entry: "index.ts",
    ...(input.manifest.description ? { description: input.manifest.description } : {}),
    ...(input.manifest.dependencies ? { dependencies: input.manifest.dependencies } : {}),
    enabled: true,
  };
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  if (input.files) {
    for (const [relPath, fileContent] of Object.entries(input.files)) {
      const fullPath = join(dir, "src", relPath);
      await mkdir(join(dir, "src", relPath, ".."), { recursive: true });
      await writeFile(fullPath, fileContent, "utf8");
    }
  }
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ path: dir }) }] };
}

export async function updatePlugin(input: {
  name: string;
  content?: string;
  manifest?: Partial<PluginManifest>;
  files?: Record<string, string>;
}) {
  const root = getRoot();
  const dir = join(root, "plugins", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Plugin not found: ${input.name}`);
  if (input.content !== undefined) await writeFile(join(dir, "index.ts"), input.content, "utf8");
  if (input.manifest !== undefined) {
    const manifestPath = join(dir, "manifest.json");
    const existing: PluginManifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const merged = { ...existing, ...input.manifest };
    await writeFile(manifestPath, JSON.stringify(merged, null, 2), "utf8");
  }
  if (input.files) {
    for (const [relPath, fileContent] of Object.entries(input.files)) {
      const fullPath = join(dir, "src", relPath);
      await mkdir(join(dir, "src", relPath, ".."), { recursive: true });
      await writeFile(fullPath, fileContent, "utf8");
    }
  }
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
}

export async function removePlugin(input: { name: string }) {
  const root = getRoot();
  const dir = join(root, "plugins", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Plugin not found: ${input.name}`);
  await rm(dir, { recursive: true, force: true });
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
}

async function setEnabled(name: string, enabled: boolean) {
  const root = getRoot();
  const dir = join(root, "plugins", name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Plugin not found: ${name}`);
  const manifestPath = join(dir, "manifest.json");
  const manifest: PluginManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.enabled = enabled;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
}

export const enablePlugin = (input: { name: string }) => setEnabled(input.name, true);
export const disablePlugin = (input: { name: string }) => setEnabled(input.name, false);
