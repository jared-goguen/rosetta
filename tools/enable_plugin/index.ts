import { join } from "path";
import { writeFile, readFile, stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getRoot } from "../../src/scanner.js";
import { rebuildBundle } from "../../src/bundle.js";
import type { PluginManifest } from "../../src/types.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
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
