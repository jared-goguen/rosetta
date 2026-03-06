import { join } from "path";
import { readdir, readFile, stat } from "fs/promises";
import type { ToolRecord, CommandRecord, PluginRecord, PluginManifest } from "./types.js";

export function getRoot(): string {
  return process.env.ROSETTA_ROOT ?? process.cwd();
}

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function readOptional(p: string): Promise<string | undefined> {
  try { return await readFile(p, "utf8"); } catch { return undefined; }
}

async function parseJsonOptional(p: string): Promise<object | undefined> {
  const text = await readOptional(p);
  if (!text) return undefined;
  return JSON.parse(text);
}

// ── Tools ─────────────────────────────────────────────────────────────────────

export async function readTool(name: string, root = getRoot()): Promise<ToolRecord> {
  const dir = join(root, "tools", name);
  const entryPath = join(dir, "index.ts");
  const content = await readFile(entryPath, "utf8");
  const description = await readOptional(join(dir, "purpose.md"));
  const schemaRaw = await parseJsonOptional(join(dir, "schema.json")) as any;
  const schema = schemaRaw ? { input: schemaRaw.input ?? {}, output: schemaRaw.output ?? {} } : undefined;
  return { name, path: dir, content, description, schema };
}

export async function scanTools(root = getRoot()): Promise<ToolRecord[]> {
  const dir = join(root, "tools");
  if (!await exists(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const results: ToolRecord[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const entryPath = join(dir, e.name, "index.ts");
    if (!await exists(entryPath)) continue;
    results.push(await readTool(e.name, root));
  }
  return results;
}

// ── Commands ──────────────────────────────────────────────────────────────────

export async function readCommand(name: string, root = getRoot()): Promise<CommandRecord> {
  const dir = join(root, "commands", name);
  const entryPath = join(dir, "index.ts");
  const content = await readFile(entryPath, "utf8");
  const description = await readOptional(join(dir, "purpose.md"));
  const schema = await parseJsonOptional(join(dir, "schema.json"));
  return { name, path: dir, content, description, schema };
}

export async function scanCommands(root = getRoot()): Promise<CommandRecord[]> {
  const dir = join(root, "commands");
  if (!await exists(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const results: CommandRecord[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const entryPath = join(dir, e.name, "index.ts");
    if (!await exists(entryPath)) continue;
    results.push(await readCommand(e.name, root));
  }
  return results;
}

// ── Plugins ───────────────────────────────────────────────────────────────────

async function listFilesRecursive(dir: string, base: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    const rel = join(base, e.name);
    if (e.isDirectory()) {
      files.push(...await listFilesRecursive(full, rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

export async function readPlugin(name: string, root = getRoot()): Promise<PluginRecord> {
  const dir = join(root, "plugins", name);
  const manifestPath = join(dir, "manifest.json");
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest: PluginManifest = JSON.parse(manifestText);
  const content = await readFile(join(dir, "index.ts"), "utf8");
  const files = await listFilesRecursive(dir, "");
  return { name, path: dir, manifest, content, files };
}

export async function scanPlugins(root = getRoot()): Promise<PluginRecord[]> {
  const dir = join(root, "plugins");
  if (!await exists(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const results: PluginRecord[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const hasEntry = await exists(join(dir, e.name, "index.ts"));
    const hasManifest = await exists(join(dir, e.name, "manifest.json"));
    if (!hasEntry || !hasManifest) continue;
    results.push(await readPlugin(e.name, root));
  }
  return results;
}
