import { join } from "path";
import { mkdir, writeFile, rm, stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { scanTools, readTool, getRoot } from "../scanner.js";
import { rebuildBundle } from "../bundle.js";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

export async function listTools() {
  const tools = await scanTools(getRoot());
  const result = tools.map(t => ({ name: t.name, description: t.description }));
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}

export async function getTool(input: { name: string }) {
  const root = getRoot();
  const dir = join(root, "tools", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Tool not found: ${input.name}`);
  const tool = await readTool(input.name, root);
  return { content: [{ type: "text" as const, text: JSON.stringify(tool) }] };
}

export async function addTool(input: {
  name: string;
  content: string;
  description?: string;
  schema?: { input: object; output: object };
}) {
  const root = getRoot();
  const dir = join(root, "tools", input.name);
  if (await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Tool already exists: ${input.name}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.ts"), input.content, "utf8");
  if (input.description) await writeFile(join(dir, "purpose.md"), input.description, "utf8");
  if (input.schema) await writeFile(join(dir, "schema.json"), JSON.stringify(input.schema, null, 2), "utf8");
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ path: dir }) }] };
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
    try { existing = JSON.parse(await (await import("fs/promises")).readFile(schemaPath, "utf8")); } catch {}
    const merged = { ...existing, ...input.schema };
    await writeFile(schemaPath, JSON.stringify(merged, null, 2), "utf8");
  }
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
}

export async function removeTool(input: { name: string }) {
  const root = getRoot();
  const dir = join(root, "tools", input.name);
  if (!await exists(dir)) throw new McpError(ErrorCode.InvalidParams, `Tool not found: ${input.name}`);
  await rm(dir, { recursive: true, force: true });
  await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
}
