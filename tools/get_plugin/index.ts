import { join } from "path";
import { stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { readPlugin, getRoot } from "../../src/scanner.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

export async function getPlugin(input: { name: string }) {
  const root = getRoot();
  const dir = join(root, "plugins", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Plugin not found: ${input.name}`);
  const plugin = await readPlugin(input.name, root);
  return { content: [{ type: "text" as const, text: JSON.stringify(plugin) }] };
}