import { join } from "path";
import { stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { readCommand, getRoot } from "../../src/scanner.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

export async function getCommand(input: { name: string }) {
  const root = getRoot();
  const dir = join(root, "commands", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Command not found: ${input.name}`);
  const command = await readCommand(input.name, root);
  return { content: [{ type: "text" as const, text: JSON.stringify(command) }] };
}