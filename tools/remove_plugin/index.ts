import { join } from "path";
import { rm, stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getRoot } from "../../src/scanner.js";
import { rebuildBundle } from "../../src/bundle.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

export async function removePlugin(input: { name: string }) {
  const root = getRoot();
  const dir = join(root, "plugins", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Plugin not found: ${input.name}`);
  await rm(dir, { recursive: true, force: true });
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
}
