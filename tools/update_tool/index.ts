import { join } from "path";
import { writeFile, readFile, stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getRoot } from "../../src/scanner.js";
import { rebuildBundle } from "../../src/bundle.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

export async function updateTool(input: {
  name: string;
  content?: string;
  description?: string;
  schema?: { input?: object; output?: object };
}) {
  const root = getRoot();
  const dir = join(root, "tools", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Tool not found: ${input.name}`);
  if (input.content !== undefined) await writeFile(join(dir, "index.ts"), input.content, "utf8");
  if (input.description !== undefined) await writeFile(join(dir, "purpose.md"), input.description, "utf8");
  if (input.schema !== undefined) {
    const schemaPath = join(dir, "schema.json");
    let existing: any = {};
    try { existing = JSON.parse(await readFile(schemaPath, "utf8")); } catch {}
    const merged = { ...existing, ...input.schema };
    await writeFile(schemaPath, JSON.stringify(merged, null, 2), "utf8");
  }
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
}