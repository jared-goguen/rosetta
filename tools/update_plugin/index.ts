import { join } from "path";
import { mkdir, writeFile, readFile, stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getRoot } from "../../src/scanner.js";
import { rebuildBundle } from "../../src/bundle.js";
import type { PluginManifest } from "../../src/types.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
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
