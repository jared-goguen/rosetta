import { join } from "path";
import { writeFile, stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getRoot } from "../../src/scanner.js";
import { rebuildBundle } from "../../src/bundle.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

export async function updateCommand(input: {
  name: string;
  content?: string;
  description?: string;
  schema?: object;
}) {
  const root = getRoot();
  const dir = join(root, "commands", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Command not found: ${input.name}`);
  if (input.content !== undefined) await writeFile(join(dir, "index.ts"), input.content, "utf8");
  if (input.description !== undefined) await writeFile(join(dir, "purpose.md"), input.description, "utf8");
  if (input.schema !== undefined) await writeFile(join(dir, "schema.json"), JSON.stringify(input.schema, null, 2), "utf8");
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
}