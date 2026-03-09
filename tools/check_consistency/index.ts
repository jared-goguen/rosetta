import { join } from "path";
import { readdir, stat } from "fs/promises";

const ROOT = process.env.ROSETTA_ROOT ?? "/home/jared/source";
const KNOWN_SERVERS = ["rosetta", "gutenberg", "flowbot", "grounder", "scout"];

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

interface ServerCheck {
  name: string;
  status: string; // "✅", "⚠️", or "❌"
  checks: Record<string, boolean | string | number>;
  issues: string[];
}

async function checkServer(serverName: string): Promise<ServerCheck> {
  const serverPath = join(ROOT, serverName);
  const check: ServerCheck = {
    name: serverName,
    status: "✅",
    checks: {},
    issues: [],
  };

  // Check for AGENTS.md
  const agentsPath = join(serverPath, "AGENTS.md");
  check.checks["AGENTS.md"] = await exists(agentsPath);
  if (!check.checks["AGENTS.md"]) {
    check.issues.push("Missing AGENTS.md");
    check.status = "⚠️";
  }

  // Check for README.md
  const readmePath = join(serverPath, "README.md");
  check.checks["README.md"] = await exists(readmePath);
  if (!check.checks["README.md"]) {
    check.issues.push("Missing README.md");
    check.status = "⚠️";
  }

  // Check for src/index.ts
  const srcIndexPath = join(serverPath, "src", "index.ts");
  check.checks["src/index.ts"] = await exists(srcIndexPath);
  if (!check.checks["src/index.ts"]) {
    check.issues.push("Missing src/index.ts");
    check.status = "❌";
  }

  // Check tools directory and count tools
  const toolsDir = join(serverPath, "tools");
  if (await exists(toolsDir)) {
    try {
      const entries = await readdir(toolsDir, { withFileTypes: true });
      const toolDirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
        .map((e) => e.name);
      check.checks["tool_count"] = toolDirs.length;

      // Check each tool for required files
      const toolIssues: string[] = [];
      for (const tool of toolDirs) {
        const toolPath = join(toolsDir, tool);
        const hasIndex = await exists(join(toolPath, "index.ts"));
        const hasSchema = await exists(join(toolPath, "schema.json"));

        if (!hasIndex || !hasSchema) {
          const missing: string[] = [];
          if (!hasIndex) missing.push("index.ts");
          if (!hasSchema) missing.push("schema.json");
          toolIssues.push(`${tool}: missing ${missing.join(", ")}`);
        }
      }

      if (toolIssues.length > 0) {
        check.issues.push(...toolIssues);
        check.status = "❌";
      }
    } catch (e) {
      check.issues.push("Failed to scan tools directory");
      check.status = "❌";
    }
  } else {
    check.checks["tools/"] = false;
    check.issues.push("Missing tools/ directory");
    check.status = "❌";
  }

  return check;
}

export async function handler(
  input: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const serverList = input.servers as string[] | undefined;
    const serversToCheck = serverList || KNOWN_SERVERS;

    const results: ServerCheck[] = [];

    for (const server of serversToCheck) {
      const serverPath = join(ROOT, server);
      if (await exists(serverPath)) {
        const check = await checkServer(server);
        results.push(check);
      } else {
        results.push({
          name: server,
          status: "❌",
          checks: { exists: false },
          issues: ["Server directory not found"],
        });
      }
    }

    // Build report
    let report = "📋 MCP Consistency Report\n\n";
    let errorCount = 0;
    let warningCount = 0;

    for (const result of results) {
      report += `${result.status} ${result.name}\n`;

      for (const [check, value] of Object.entries(result.checks)) {
        if (typeof value === "boolean") {
          report += `   - ${check}: ${value ? "✅" : "❌"}\n`;
        } else {
          report += `   - ${check}: ${value}\n`;
        }
      }

      if (result.issues.length > 0) {
        for (const issue of result.issues) {
          report += `   ⚠️ ${issue}\n`;
        }
      }
      report += "\n";

      if (result.status === "❌") errorCount++;
      if (result.status === "⚠️") warningCount++;
    }

    const summary =
      errorCount === 0 && warningCount === 0
        ? "✅ All servers are consistent"
        : `⚠️ Found ${errorCount} error(s) and ${warningCount} warning(s)`;

    report = summary + "\n\n" + report;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            summary,
            report,
            details: {
              servers: results,
              errorCount,
              warningCount,
            },
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
            error: `Consistency check failed: ${error instanceof Error ? error.message : String(error)}`,
          }),
        },
      ],
    };
  }
}
