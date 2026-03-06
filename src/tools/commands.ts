import { join } from "path";
import { mkdir, writeFile, rm, stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { scanCommands, readCommand, getRoot } from "../scanner.js";
import { rebuildBundle } from "../bundle.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

export async function listCommands() {
  const commands = await scanCommands(getRoot());
  const result = commands.map(c => ({ name: c.name, description: c.description }));
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}

export async function getCommand(input: { name: string }) {
  const root = getRoot();
  const dir = join(root, "commands", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Command not found: ${input.name}`);
  const command = await readCommand(input.name, root);
  return { content: [{ type: "text" as const, text: JSON.stringify(command) }] };
}

export async function addCommand(input: {
  name: string;
  content: string;
  description?: string;
  schema?: object;
}) {
  const root = getRoot();
  const dir = join(root, "commands", input.name);
  if (await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Command already exists: ${input.name}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.ts"), input.content, "utf8");
  if (input.description) await writeFile(join(dir, "purpose.md"), input.description, "utf8");
  if (input.schema) await writeFile(join(dir, "schema.json"), JSON.stringify(input.schema, null, 2), "utf8");
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ path: dir }) }] };
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

export async function removeCommand(input: { name: string }) {
  const root = getRoot();
  const dir = join(root, "commands", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Command not found: ${input.name}`);
  await rm(dir, { recursive: true, force: true });
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
}
