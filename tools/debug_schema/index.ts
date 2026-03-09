import { join } from "path";
import { readdir, readFile, stat } from "fs/promises";

const ROOT = process.env.ROSETTA_ROOT ?? "/home/jared/source";

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(p: string): Promise<string | undefined> {
  try {
    return await readFile(p, "utf8");
  } catch {
    return undefined;
  }
}

async function parseJsonOptional(p: string): Promise<object | undefined> {
  const text = await readOptional(p);
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

interface DebugResult {
  diskScan: { exists: boolean; files: Record<string, boolean> };
  scannerFound: boolean;
  bundleIncludes: boolean;
  schemaIncludes: boolean;
  status: string;
  issue?: string;
  suggestion?: string;
}

async function debugTool(
  toolName: string,
  serverName: string
): Promise<DebugResult> {
  const result: DebugResult = {
    diskScan: { exists: false, files: {} },
    scannerFound: false,
    bundleIncludes: false,
    schemaIncludes: false,
    status: "unknown",
  };

  // Stage 1: Check disk
  const toolDir = join(ROOT, serverName, "tools", toolName);
  result.diskScan.exists = await exists(toolDir);
  
  if (result.diskScan.exists) {
    result.diskScan.files["index.ts"] = await exists(join(toolDir, "index.ts"));
    result.diskScan.files["schema.json"] = await exists(
      join(toolDir, "schema.json")
    );
    result.diskScan.files["AGENTS.md"] = await exists(
      join(toolDir, "AGENTS.md")
    );
  }

  // Stage 2: Check if schema includes it
  const schemaPath = join(ROOT, "rosetta", "rosetta.schema.json");
  const schema = (await parseJsonOptional(schemaPath)) as any;
  if (schema && schema.tools) {
    const tool = schema.tools.find(
      (t: any) => t.name === toolName && t.server === serverName
    );
    result.schemaIncludes = !!tool;
  }

  // Determine status
  if (!result.diskScan.exists) {
    result.status = "❌ Tool not found";
    result.issue = `Directory does not exist: ${toolDir}`;
    result.suggestion = "Create the tool directory and files";
  } else if (!result.diskScan.files["index.ts"]) {
    result.status = "❌ Tool incomplete";
    result.issue = "index.ts is missing";
    result.suggestion = "Create index.ts with handler function";
  } else if (!result.diskScan.files["schema.json"]) {
    result.status = "❌ Tool incomplete";
    result.issue = "schema.json is missing";
    result.suggestion = "Create schema.json with input/output schemas";
  } else if (!result.schemaIncludes) {
    result.status = "⚠️ Tool not in schema";
    result.issue = "Tool exists on disk but not in schema";
    result.suggestion = "Run rosetta_rebuild to regenerate schema";
  } else {
    result.status = "✅ Tool properly registered";
  }

  return result;
}

export async function handler(
  input: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const toolName = input.tool_name as string | undefined;
  const server = input.server as string | undefined;

  if (!toolName || !server) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Both tool_name and server are required",
          }),
        },
      ],
    };
  }

  try {
    const result = await debugTool(toolName, server);

    const report = `📊 Schema Debug Report
    
Tool: ${server}/${toolName}

Disk scan:
  ${result.diskScan.exists ? "✅" : "❌"} ${server}/tools/${toolName}/ exists
  ${
    result.diskScan.files["index.ts"]
      ? "✅"
      : "❌"
  } - index.ts ${result.diskScan.files["index.ts"] ? "" : "(missing)"}
  ${
    result.diskScan.files["schema.json"]
      ? "✅"
      : "❌"
  } - schema.json ${result.diskScan.files["schema.json"] ? "" : "(missing)"}
  ${
    result.diskScan.files["AGENTS.md"]
      ? "✅"
      : "❌"
  } - AGENTS.md ${result.diskScan.files["AGENTS.md"] ? "" : "(missing)"}

Schema includes tool:
  ${result.schemaIncludes ? "✅" : "❌"} Found in rosetta.schema.json

Status: ${result.status}
${result.issue ? `Issue: ${result.issue}` : ""}
${result.suggestion ? `Fix: ${result.suggestion}` : ""}`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: result.status.includes("✅") ? "ok" : "failed",
            report,
            details: result,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: `Debug failed: ${error instanceof Error ? error.message : String(error)}`,
          }),
        },
      ],
    };
  }
}
