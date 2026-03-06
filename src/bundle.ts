import { join } from "path";
import { writeFile } from "fs/promises";
import { scanTools, scanCommands, scanPlugins, getRoot } from "./scanner.js";
import type { ToolRecord, CommandRecord, PluginRecord, RosettaSchema, ToolDefinition, CommandDefinition, PluginDefinition } from "./types.js";

const SCHEMA_VERSION = "1";

export function generateBundle(
  tools: ToolRecord[],
  commands: CommandRecord[],
  plugins: PluginRecord[]
): RosettaSchema {
  const toolDefs: ToolDefinition[] = tools.map(t => ({
    name: t.name,
    ...(t.description ? { description: t.description } : {}),
    schema: t.schema ?? null,
  }));

  const commandDefs: CommandDefinition[] = commands.map(c => ({
    name: c.name,
    ...(c.description ? { description: c.description } : {}),
    schema: c.schema ?? null,
  }));

  const pluginDefs: PluginDefinition[] = plugins.map(p => ({
    name: p.name,
    version: p.manifest.version,
    ...(p.manifest.description ? { description: p.manifest.description } : {}),
    dependencies: p.manifest.dependencies ?? [],
    enabled: p.manifest.enabled ?? true,
  }));

  return {
    version: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    tools: toolDefs,
    commands: commandDefs,
    plugins: pluginDefs,
  };
}

export async function writeBundle(schema: RosettaSchema, root: string): Promise<void> {
  const bundlePath = process.env.ROSETTA_BUNDLE_PATH ?? join(root, "rosetta.schema.json");
  await writeFile(bundlePath, JSON.stringify(schema, null, 2), "utf8");
}

export async function rebuildBundle(root = getRoot()): Promise<RosettaSchema> {
  const [tools, commands, plugins] = await Promise.all([
    scanTools(root),
    scanCommands(root),
    scanPlugins(root),
  ]);
  const schema = generateBundle(tools, commands, plugins);
  await writeBundle(schema, root);
  return schema;
}
