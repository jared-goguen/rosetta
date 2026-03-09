import { join } from "path";
import { readFile, writeFile } from "fs/promises";
import { scanAllTools, scanServers, readTypeRegistry, getRoot } from "../../src/scanner.js";
import { generateBundle, writeBundle } from "../../src/bundle.js";
import type { RosettaSchema } from "../../src/types.js";

const ROOT = getRoot();

async function readJsonFile(path: string): Promise<unknown> {
  try {
    const content = await readFile(path, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

interface Change {
  added: Array<{ name: string; server: string }>;
  removed: Array<{ name: string; server: string }>;
  modified: Array<{ name: string; server: string }>;
}

function detectChanges(
  oldSchema: RosettaSchema | null,
  newSchema: RosettaSchema
): Change {
  const changes: Change = {
    added: [],
    removed: [],
    modified: [],
  };

  if (!oldSchema) {
    // All tools are "added" if no previous schema
    changes.added = newSchema.tools.map((t) => ({
      name: t.name,
      server: t.server,
    }));
    return changes;
  }

  const oldToolMap = new Map<string, any>();
  const newToolMap = new Map<string, any>();

  for (const tool of oldSchema.tools) {
    oldToolMap.set(`${tool.server}:${tool.name}`, tool);
  }

  for (const tool of newSchema.tools) {
    newToolMap.set(`${tool.server}:${tool.name}`, tool);
  }

  // Detect added and modified
  for (const [key, newTool] of newToolMap) {
    const oldTool = oldToolMap.get(key);
    if (!oldTool) {
      changes.added.push({
        name: newTool.name,
        server: newTool.server,
      });
    } else if (JSON.stringify(oldTool) !== JSON.stringify(newTool)) {
      changes.modified.push({
        name: newTool.name,
        server: newTool.server,
      });
    }
  }

  // Detect removed
  for (const [key, oldTool] of oldToolMap) {
    if (!newToolMap.has(key)) {
      changes.removed.push({
        name: oldTool.name,
        server: oldTool.server,
      });
    }
  }

  return changes;
}

export async function handler(
  input: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const force = (input.force as boolean) ?? false;

    let report = "🔄 Schema Rebuild\n\n";

    // Load old schema
    const schemaPath = join(ROOT, "rosetta", "rosetta.schema.json");
    const oldSchema = (await readJsonFile(schemaPath)) as RosettaSchema | null;

    report += "Scanning tools...\n";
    const [tools, servers, typeRegistry] = await Promise.all([
      scanAllTools(ROOT),
      scanServers(ROOT),
      readTypeRegistry(ROOT),
    ]);

    report += `  Found ${tools.length} tools across ${servers.length} servers\n\n`;

    // Generate new schema
    report += "Generating bundle...\n";
    const newSchema = generateBundle(tools, servers, typeRegistry);

    // Detect changes
    const changes = detectChanges(oldSchema, newSchema);

    // Write schema
    report += "Writing schema...\n";
    await writeBundle(newSchema, ROOT);
    report += `  ✅ Written to ${schemaPath}\n\n`;

    // Report changes
    report += "Changes:\n";
    if (changes.added.length === 0 &&
        changes.removed.length === 0 &&
        changes.modified.length === 0) {
      report += "  No changes detected\n";
    } else {
      if (changes.added.length > 0) {
        report += `  + ${changes.added.length} added\n`;
        for (const tool of changes.added) {
          report += `    + ${tool.server}/${tool.name}\n`;
        }
      }
      if (changes.removed.length > 0) {
        report += `  - ${changes.removed.length} removed\n`;
        for (const tool of changes.removed) {
          report += `    - ${tool.server}/${tool.name}\n`;
        }
      }
      if (changes.modified.length > 0) {
        report += `  ~ ${changes.modified.length} modified\n`;
        for (const tool of changes.modified) {
          report += `    ~ ${tool.server}/${tool.name}\n`;
        }
      }
    }

    report += `\nTotal: ${tools.length} tools\n`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            report,
            details: {
              toolCount: tools.length,
              serverCount: servers.length,
              changes: {
                added: changes.added.length,
                removed: changes.removed.length,
                modified: changes.modified.length,
              },
            },
          }),
        },
      ],
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    const report = `🔄 Schema Rebuild\n\n❌ Error: ${errorMsg}`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            report,
            details: {
              error: errorMsg,
            },
          }),
        },
      ],
    };
  }
}
