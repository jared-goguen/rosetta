import { scanPlugins, getRoot } from "../../src/scanner.js";

export async function listPlugins() {
  const plugins = await scanPlugins(getRoot());
  const result = plugins.map(p => ({
    name: p.name,
    version: p.manifest.version,
    description: p.manifest.description,
    enabled: p.manifest.enabled ?? true,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}