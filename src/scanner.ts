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

// --- Semantic Tag Inference ---

interface InferenceTable {
  inference: Record<string, string[]>;
}

let inferenceTableCache: InferenceTable | null = null;

async function loadInferenceTable(root: string): Promise<InferenceTable> {
  if (inferenceTableCache) return inferenceTableCache;
  
  const inferPath = join(root, "rosetta", "infer.json");
  const content = await readOptional(inferPath);
  if (!content) {
    inferenceTableCache = { inference: {} };
    return inferenceTableCache;
  }
  
  inferenceTableCache = JSON.parse(content) as InferenceTable;
  return inferenceTableCache;
}

/**
 * Infer tags from $domain and $operation annotations.
 * Merges inferred tags with any explicit tags in the schema.
 */
async function inferTags(
  schema: any,
  root: string
): Promise<string[] | undefined> {
  const explicit = schema?.tags as string[] | undefined;
  const domain = schema?.$domain as string | undefined;
  const operation = schema?.$operation as string | undefined;
  
  // No semantic annotations → return explicit tags only
  if (!domain || !operation) {
    return explicit;
  }
  
  const table = await loadInferenceTable(root);
  const key = `${domain}:${operation}`;
  const inferred = table.inference[key] ?? [];
  
  // Merge inferred + explicit, deduplicate
  const merged = [...new Set([...inferred, ...(explicit ?? [])])];
  return merged.length > 0 ? merged : undefined;
}

/**
 * Scan a single tool using convention structure.
 * Convention: tools/<name>/index.ts, schema.json, purpose.md
 */
async function readConventionTool(
  name: string,
  toolDir: string,
  serverName: string,
  root: string
): Promise<ToolRecord | null> {
  const indexPath = join(toolDir, "index.ts");
  const schemaPath = join(toolDir, "schema.json");
  const purposePath = join(toolDir, "purpose.md");
  const agentsPath = join(toolDir, "AGENTS.md");

  if (!await exists(indexPath)) return null;

  // Try AGENTS.md first (convention used by existing tools), then purpose.md
  let description = await readOptional(agentsPath);
  if (!description) {
    description = await readOptional(purposePath);
  }
  const schema = await parseJsonOptional(schemaPath) as any;
  
  // Infer tags from $domain + $operation, merge with explicit tags
  const tags = await inferTags(schema, root);

  return {
    name,
    server: serverName,
    description: description?.split("\n")[0],  // First line only
    schema: schema ? { 
      input: schema.input ?? { type: "object" }, 
      output: schema.output ?? { type: "object" },
      ...(schema.mcp_dependencies ? { mcp_dependencies: schema.mcp_dependencies } : {})
    } : { input: { type: "object" }, output: { type: "object" } },
    tags
  };
}

/**
 * Scan all tools in a convention-based server (rosetta, gutenberg, flowbot, grounder).
 * Structure: server/tools/<name>/
 */
async function scanConventionServer(
  serverPath: string,
  serverName: string,
  root: string
): Promise<ToolRecord[]> {
  const toolsDir = join(serverPath, "tools");
  if (!await exists(toolsDir)) return [];

  const entries = await readdir(toolsDir, { withFileTypes: true });
  const results: ToolRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Skip directories starting with _ (e.g., _deprecated)
    if (entry.name.startsWith('_')) continue;
    const tool = await readConventionTool(
      entry.name,
      join(toolsDir, entry.name),
      serverName,
      root
    );
    if (tool) results.push(tool);
  }

  return results;
}

/**
 * Auto-discover convention-based servers by scanning root directory.
 * A valid server must have: src/index.ts and tools/ directory
 */
async function discoverConventionServerNames(root: string): Promise<string[]> {
  const serverNames: string[] = [];
  
  const entries = await readdir(root, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    // Skip hidden directories and common non-server directories
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    
    const serverPath = join(root, entry.name);
    const hasIndex = await exists(join(serverPath, "src", "index.ts"));
    const hasTools = await exists(join(serverPath, "tools"));
    
    // Valid server: has both src/index.ts and tools/ directory
    if (hasIndex && hasTools) {
      serverNames.push(entry.name);
    }
  }
  
  return serverNames.sort();
}

/**
 * Scan all convention-based servers in the monorepo.
 */
async function scanConventionServers(root: string): Promise<ToolRecord[]> {
  const serverNames = await discoverConventionServerNames(root);
  const allTools: ToolRecord[] = [];

  for (const name of serverNames) {
    const path = join(root, name);
    const tools = await scanConventionServer(path, name, root);
    allTools.push(...tools);
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
      } : { input: { type: "object" }, output: { type: "object" } },
      tags: schema?.tags as string[] | undefined
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
  
  // Convention-based (auto-discover)
  const conventionNames = await discoverConventionServerNames(root);
  for (const name of conventionNames) {
    serverNames.add(name);
  }

  // Export-based (packages/mcp-server-*)
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
    // Convention-based servers are "local" (bundled in monorepo)
    const isConventionBased = conventionNames.includes(name);
    servers.push({
      name,
      type: isConventionBased ? "local" : "local",
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
