import { join } from "path";
import { readdir, readFile, stat } from "fs/promises";
import type { ToolRecord, ServerRecord } from "./types.js";

export function getRoot(): string {
  return process.env.ROSETTA_ROOT ?? "/home/jared/source";
}

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function readOptional(p: string): Promise<string | undefined> {
  try { return await readFile(p, "utf8"); } catch { return undefined; }
}

async function parseJsonOptional(p: string): Promise<object | undefined> {
  const text = await readOptional(p);
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

/**
 * Scan a single tool using convention structure.
 * Convention: tools/<name>/index.ts, schema.json, purpose.md
 */
async function readConventionTool(
  name: string,
  toolDir: string,
  serverName: string
): Promise<ToolRecord | null> {
  const indexPath = join(toolDir, "index.ts");
  const schemaPath = join(toolDir, "schema.json");
  const purposePath = join(toolDir, "purpose.md");

  if (!await exists(indexPath)) return null;

  const description = await readOptional(purposePath);
  const schema = await parseJsonOptional(schemaPath) as any;

  return {
    name,
    server: serverName,
    description: description?.split("\n")[0],  // First line only
    schema: schema ? { 
      input: schema.input ?? { type: "object" }, 
      output: schema.output ?? { type: "object" } 
    } : { input: { type: "object" }, output: { type: "object" } }
  };
}

/**
 * Scan all tools in a convention-based server (rosetta, gutenberg, flowbot, grounder).
 * Structure: server/tools/<name>/
 */
async function scanConventionServer(
  serverPath: string,
  serverName: string
): Promise<ToolRecord[]> {
  const toolsDir = join(serverPath, "tools");
  if (!await exists(toolsDir)) return [];

  const entries = await readdir(toolsDir, { withFileTypes: true });
  const results: ToolRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const tool = await readConventionTool(
      entry.name,
      join(toolsDir, entry.name),
      serverName
    );
    if (tool) results.push(tool);
  }

  return results;
}

/**
 * Scan all convention-based servers in the monorepo.
 */
async function scanConventionServers(root: string): Promise<ToolRecord[]> {
  const servers = [
    { name: "rosetta", path: join(root, "rosetta") },
    { name: "gutenberg", path: join(root, "gutenberg") },
    { name: "flowbot", path: join(root, "flowbot") },
    { name: "grounder", path: join(root, "grounder") }
  ];

  const allTools: ToolRecord[] = [];

  for (const server of servers) {
    if (await exists(server.path)) {
      const tools = await scanConventionServer(server.path, server.name);
      allTools.push(...tools);
    }
  }

  return allTools;
}

/**
 * Scan export-based server (packages/mcp-server-*).
 * Structure: tools/*.ts with exported *Schema objects
 */
async function scanExportServer(
  serverPath: string,
  serverName: string
): Promise<ToolRecord[]> {
  const toolsDir = join(serverPath, "tools");
  if (!await exists(toolsDir)) return [];

  const entries = await readdir(toolsDir, { withFileTypes: true });
  const results: ToolRecord[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;

    // Tool name is filename without .ts extension
    const toolName = entry.name.replace(/\.ts$/, "");
    const content = await readOptional(join(toolsDir, entry.name));
    
    if (!content) continue;

    // Extract schema from exported *Schema object
    const schemaMatch = content.match(/export\s+(?:const|let)\s+(\w+)Schema\s*=\s*({[\s\S]*?}(?=\n\nexport|$))/);
    let schema: any = undefined;

    if (schemaMatch) {
      try {
        // Very basic extraction - assumes valid JSON-like structure
        const schemaStr = schemaMatch[2];
        // Parse as much as we can
        schema = JSON.parse(schemaStr);
      } catch {
        // If parsing fails, use default
        schema = { input: { type: "object" }, output: { type: "object" } };
      }
    }

    results.push({
      name: toolName,
      server: serverName,
      description: undefined,  // Not available in export-based tools
      schema: schema ? {
        input: schema.inputSchema ?? schema.input ?? { type: "object" },
        output: schema.outputSchema ?? schema.output ?? { type: "object" }
      } : { input: { type: "object" }, output: { type: "object" } }
    });
  }

  return results;
}

/**
 * Scan all export-based servers in packages/.
 */
async function scanExportServers(root: string): Promise<ToolRecord[]> {
  const packagesDir = join(root, "packages");
  if (!await exists(packagesDir)) return [];

  const entries = await readdir(packagesDir, { withFileTypes: true });
  const allTools: ToolRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("mcp-server-")) continue;
    
    const serverName = entry.name.replace("mcp-server-", "");
    const serverPath = join(packagesDir, entry.name);
    const tools = await scanExportServer(serverPath, serverName);
    allTools.push(...tools);
  }

  return allTools;
}

/**
 * Scan all servers and return unified server registry.
 */
async function scanServerMetadata(root: string): Promise<ServerRecord[]> {
  const serverNames = new Set<string>();
  
  // Convention-based
  for (const name of ["rosetta", "gutenberg", "flowbot", "grounder"]) {
    const path = join(root, name);
    if (await exists(path)) serverNames.add(name);
  }

  // Export-based
  const packagesDir = join(root, "packages");
  if (await exists(packagesDir)) {
    const entries = await readdir(packagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("mcp-server-")) {
        serverNames.add(entry.name.replace("mcp-server-", ""));
      }
    }
  }

  // Get tool counts for each server
  const servers: ServerRecord[] = [];
  for (const name of Array.from(serverNames).sort()) {
    // Tool count will be calculated separately in bundle.ts
    servers.push({
      name,
      type: ["rosetta", "gutenberg", "flowbot", "grounder"].includes(name) ? "local" : "local",
      description: ""  // Can be enriched later
    });
  }

  return servers;
}

/**
 * Main scanning function: scan entire monorepo for tools.
 */
export async function scanAllTools(root = getRoot()): Promise<ToolRecord[]> {
  const conventionTools = await scanConventionServers(root);
  const exportTools = await scanExportServers(root);
  
  // Merge and deduplicate by server + name
  const toolMap = new Map<string, ToolRecord>();
  
  for (const tool of [...conventionTools, ...exportTools]) {
    const key = `${tool.server}:${tool.name}`;
    // Convention tools take precedence
    if (!toolMap.has(key) || tool.schema) {
      toolMap.set(key, tool);
    }
  }
  
  return Array.from(toolMap.values()).sort((a, b) => {
    if (a.server !== b.server) return a.server.localeCompare(b.server);
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get server metadata.
 */
export async function scanServers(root = getRoot()): Promise<ServerRecord[]> {
  return scanServerMetadata(root);
}

/**
 * Read type registry.
 */
export async function readTypeRegistry(root = getRoot()): Promise<Record<string, any>> {
  const registryPath = join(root, "rosetta", "types.json");
  const content = await readOptional(registryPath);
  if (!content) return {};
  const parsed = JSON.parse(content);
  return parsed.types ?? {};
}
