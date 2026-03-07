import { join } from "path";
import { writeFile } from "fs/promises";
import { stringify as stringifyYAML } from "yaml";
import { getRoot } from "../../src/scanner.js";
import { rebuildBundle } from "../../src/bundle.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { ServerDefinition } from "../../src/types.js";

export async function registerServer(input: {
  name: string;
  type: "local" | "remote";
  location?: string;
  url?: string;
  description?: string;
  tools: string[];
  enabled?: boolean;
}) {
  const root = getRoot();

  // Validate input
  if (input.type === "local" && !input.location) {
    throw new McpError(ErrorCode.InvalidParams, "Local servers require 'location' parameter");
  }
  if (input.type === "remote" && !input.url) {
    throw new McpError(ErrorCode.InvalidParams, "Remote servers require 'url' parameter");
  }

  const serverDef: ServerDefinition = {
    name: input.name,
    type: input.type,
    ...(input.location ? { location: input.location } : {}),
    ...(input.url ? { url: input.url } : {}),
    ...(input.description ? { description: input.description } : {}),
    tools: input.tools,
    enabled: input.enabled !== false,
  };

  // Write YAML file
  const serverPath = join(root, "servers", `${input.name}.yaml`);
  const yaml = stringifyYAML(serverDef);
  await writeFile(serverPath, yaml, "utf8");

  // Rebuild schema bundle
  await rebuildBundle(root);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({ success: true, server: serverDef }, null, 2),
    }],
  };
}
