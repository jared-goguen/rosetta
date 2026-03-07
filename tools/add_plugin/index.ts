import { join } from "path";
import { mkdir, writeFile, stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getRoot } from "../../src/scanner.js";
import { rebuildBundle } from "../../src/bundle.js";
import type { PluginManifest } from "../../src/types.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
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
