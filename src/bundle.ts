import { join } from "path";
import { writeFile, readFile } from "fs/promises";
import { scanAllTools, scanServers, readTypeRegistry, getRoot } from "./scanner.js";
import type { ToolRecord, ServerRecord, RosettaSchema, EnhancedToolDefinition } from "./types.js";

const SCHEMA_VERSION = "2.0.0";

/**
 * Enrich tool schema with semantic type annotations from type registry.
 */
function enrichWithSemanticTypes(
  schema: any,
  typeRegistry: Record<string, any>
): any {
  if (!schema || !typeRegistry) return schema;

  const enrich = (obj: any): any => {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(enrich);

    const enriched: any = {};
    for (const [key, value] of Object.entries(obj)) {
      enriched[key] = value;
      
      // If this is a properties object with string keys that look like parameter names,
      // and we have a matching semantic type, add x-semantic-type annotation
      if (key === "properties" && typeof value === "object" && !Array.isArray(value)) {
        for (const [propName, propSchema] of Object.entries(value as any)) {
          if (typeof propSchema === "object" && propSchema !== null) {
            const description = (propSchema as any).description || "";
            
            // Simple heuristic matching: look for semantic type hints in description
            for (const [typeName, typeInfo] of Object.entries(typeRegistry)) {
              if (description.toLowerCase().includes(typeName.toLowerCase().replace(/([A-Z])/g, " $1").toLowerCase())) {
                (propSchema as any)["x-semantic-type"] = typeName;
                break;
              }
            }
          }
        }
      }
    }
    return enriched;
  };

  return enrich(schema);
}

/**
 * Generate the bundle from scanned tools, servers, and type registry.
 */
export function generateBundle(
  tools: ToolRecord[],
  servers: ServerRecord[],
  typeRegistry: Record<string, any>
): RosettaSchema {
  // Convert tool records to enhanced definitions
  const toolDefs: EnhancedToolDefinition[] = tools.map(t => ({
    name: t.name,
    server: t.server,
    ...(t.description ? { description: t.description } : {}),
    schema: {
      input: enrichWithSemanticTypes(t.schema.input, typeRegistry),
      output: enrichWithSemanticTypes(t.schema.output, typeRegistry)
    }
  }));

  return {
    version: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    typeRegistry,
    tools: toolDefs,
    servers
  };
}

/**
 * Write bundle to rosetta.schema.json.
 */
export async function writeBundle(schema: RosettaSchema, root: string): Promise<void> {
  const bundlePath = join(root, "rosetta", "rosetta.schema.json");
  await writeFile(bundlePath, JSON.stringify(schema, null, 2), "utf8");
}

/**
 * Main entry point: scan everything and regenerate the bundle.
 */
export async function rebuildBundle(root = getRoot()): Promise<RosettaSchema> {
  const [tools, servers, typeRegistry] = await Promise.all([
    scanAllTools(root),
    scanServers(root),
    readTypeRegistry(root)
  ]);

  const schema = generateBundle(tools, servers, typeRegistry);
  await writeBundle(schema, root);
  
  console.log(`✅ Bundle regenerated: ${tools.length} tools from ${servers.length} servers`);
  console.log(`📝 Written to: ${join(root, "rosetta", "rosetta.schema.json")}`);
  
  return schema;
}


