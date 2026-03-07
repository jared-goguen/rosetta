import { join } from "path";
import { stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { readTool, getRoot } from "../../src/scanner.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

export async function getTool(input: { name: string }) {
  const root = getRoot();
  const dir = join(root, "tools", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Tool not found: ${input.name}`);
  const tool = await readTool(input.name, root);
  return { content: [{ type: "text" as const, text: JSON.stringify(tool) }] };
}