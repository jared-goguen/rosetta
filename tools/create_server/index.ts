import { join } from "path";
import { mkdir, writeFile, readFile, stat } from "fs/promises";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function runCommand(command: string, args: string[], cwd: string, ignoreErrors: boolean = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd, stdio: "ignore" });
    proc.on("close", (code) => {
      if (code === 0 || ignoreErrors) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

async function runBunInstall(projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("bun", ["install"], { 
      cwd: projectPath, 
      stdio: "ignore" 
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`bun install failed with code ${code}`));
    });
  });
}

export async function createServer(input: {
  name: string;
  directory: string;
  dependencies?: string[];
  tools?: string[];
  git?: boolean;
  remote?: string;
  register?: boolean;
}) {
  const projectPath = join(input.directory, input.name);
  
  // Check if directory already exists
  if (await exists(projectPath)) {
    throw new McpError(ErrorCode.InvalidParams, `Directory already exists: ${projectPath}`);
  }

  const files: string[] = [];
  
  // Create main project directory
  await mkdir(projectPath, { recursive: true });
  
  // Create src directory
  await mkdir(join(projectPath, "src"), { recursive: true });
  
  // Create tests directory structure
  await mkdir(join(projectPath, "tests", "helpers"), { recursive: true });
  await mkdir(join(projectPath, "tests", "integration"), { recursive: true });
  
  // Create tools directory
  await mkdir(join(projectPath, "tools"), { recursive: true });
  
  // Generate package.json
  const baseDeps = {
    "@modelcontextprotocol/sdk": "^1.0.0"
  };
  const extraDeps = input.dependencies || [];
  const dependencies = { ...baseDeps };
  extraDeps.forEach(dep => {
    dependencies[dep] = "^1.0.0"; // Default version, users can update as needed
  });

  const packageJson = {
    name: input.name,
    version: "1.0.0",
    type: "module",
    main: "src/index.js",
    scripts: {
      start: "bun run src/index.ts",
      test: "bun test"
    },
    dependencies,
    devDependencies: {
      "@types/bun": "latest",
      "typescript": "^5.0.0"
    }
  };
  
  const packageJsonPath = join(projectPath, "package.json");
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf8");
  files.push("package.json");

  // Generate tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: "dist",
      rootDir: "src"
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist", "tests"]
  };
  
  const tsconfigPath = join(projectPath, "tsconfig.json");
  await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");
  files.push("tsconfig.json");

  // Generate src/index.ts (stdio entry point)
  const indexTs = `#!/usr/bin/env bun
import { startServer } from "./serve.js";

await startServer({
  name: "${input.name}",
  version: "1.0.0",
});
`;
  
  const indexPath = join(projectPath, "src", "index.ts");
  await writeFile(indexPath, indexTs, "utf8");
  files.push("src/index.ts");

  // Copy serve.ts from rosetta/lib
  const servePath = join(import.meta.dir, "../../lib/serve.ts");
  const serveSource = await readFile(servePath, "utf8");
  const serveDestPath = join(projectPath, "src", "serve.ts");
  await writeFile(serveDestPath, serveSource, "utf8");
  files.push("src/serve.ts");

  // Generate tests/helpers/server.ts (subprocess test harness)
  const testServerTs = `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "path";

export interface TestServer {
  client: Client;
  root: string;
  call: (tool: string, args?: Record<string, unknown>) => Promise<string>;
  close: () => Promise<void>;
}

export async function spawnServer(root: string): Promise<TestServer> {
  const serverPath = join(new URL("../../src/index.ts", import.meta.url).pathname);

  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", serverPath],
    env: { ...process.env },
  });

  const client = new Client({ name: "${input.name}-test", version: "0.0.1" });
  await client.connect(transport);

  const call = async (tool: string, args: Record<string, unknown> = {}): Promise<string> => {
    const result = await client.callTool({ name: tool, arguments: args });
    const content = result.content as Array<{ type: string; text: string }>;
    if (!content[0]) throw new Error(\`No content returned from tool: \${tool}\`);
    if (result.isError) throw new Error(content[0].text);
    return content[0].text;
  };

  const close = async () => {
    await client.close();
  };

  return { client, root, call, close };
}
`;

  const testServerPath = join(projectPath, "tests", "helpers", "server.ts");
  await writeFile(testServerPath, testServerTs, "utf8");
  files.push("tests/helpers/server.ts");

  // Generate tests/helpers/fixtures.ts
  const fixturesTs = `import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export async function makeRoot(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "${input.name}-test-"));
}

export async function cleanRoot(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}
`;

  const fixturesPath = join(projectPath, "tests", "helpers", "fixtures.ts");
  await writeFile(fixturesPath, fixturesTs, "utf8");
  files.push("tests/helpers/fixtures.ts");

  // Create initial tool directories if specified
  if (input.tools) {
    for (const toolName of input.tools) {
      const toolDir = join(projectPath, "tools", toolName);
      await mkdir(toolDir, { recursive: true });
      
      // Create empty index.ts with a handler function
      const toolIndexTs = `export async function handler(input: Record<string, unknown>) {
  // TODO: Implement ${toolName}
  return { content: [{ type: "text", text: JSON.stringify({ message: "${toolName} not yet implemented" }) }] };
}
`;
      
      const toolIndexPath = join(toolDir, "index.ts");
      await writeFile(toolIndexPath, toolIndexTs, "utf8");
      files.push(`tools/${toolName}/index.ts`);
      
      // Create empty purpose.md
      const toolPurpose = `TODO: Describe what the ${toolName} tool does.`;
      const toolPurposePath = join(toolDir, "purpose.md");
      await writeFile(toolPurposePath, toolPurpose, "utf8");
      files.push(`tools/${toolName}/purpose.md`);
      
      // Create empty schema.json
      const toolSchema = {
        input: { type: "object", properties: {}, additionalProperties: true },
        output: { type: "object", additionalProperties: true }
      };
      const toolSchemaPath = join(toolDir, "schema.json");
      await writeFile(toolSchemaPath, JSON.stringify(toolSchema, null, 2), "utf8");
      files.push(`tools/${toolName}/schema.json`);
    }
  }

  // Run bun install
  try {
    await runBunInstall(projectPath);
  } catch (err) {
    console.warn("bun install failed:", err);
    // Don't fail the whole operation if install fails
  }

  // Create .gitignore (always, unless explicitly disabled)
  if (input.git !== false) {
    const gitignore = `node_modules/
dist/
build/
*.log
.env
.env.local
.env.*.local
.DS_Store
*.swp
*.swo
*~
`;
    const gitignorePath = join(projectPath, ".gitignore");
    await writeFile(gitignorePath, gitignore, "utf8");
    files.push(".gitignore");
  }

  // Create README.md template
  const readmeContent = `# ${input.name}

An MCP server for [TODO: describe what this server does].

## Building

\`\`\`bash
cd ${projectPath}
bun install
\`\`\`

## Running

\`\`\`bash
bun run src/index.ts
\`\`\`

## Testing

\`\`\`bash
bun test
\`\`\`

## Tools

This server provides the following tools:

${input.tools?.map(tool => `- \`${tool}\` - TODO: describe what ${tool} does`).join("\n") || "- (TODO: document available tools)"}

## Configuration

[TODO: Document any required environment variables or configuration]
`;
  
  const readmePath = join(projectPath, "README.md");
  await writeFile(readmePath, readmeContent, "utf8");
  files.push("README.md");

  // Initialize git repository if requested (default: true)
  const shouldInitGit = input.git !== false;
  let remoteUrl = "";
  
  if (shouldInitGit) {
    try {
      // Initialize git repo
      await runCommand("git", ["init"], projectPath);
      await runCommand("git", ["config", "user.name", "Jared Goguen"], projectPath);
      await runCommand("git", ["config", "user.email", "jared@example.com"], projectPath);
      
      // Create initial commit
      await runCommand("git", ["add", "."], projectPath);
      await runCommand("git", ["commit", "-m", `Initial commit: ${input.name} scaffold`], projectPath);
      
      // Add remote if provided
      if (input.remote) {
        remoteUrl = input.remote;
        await runCommand("git", ["remote", "add", "origin", remoteUrl], projectPath);
        
        // Attempt to push (may fail if repo doesn't exist yet)
        await runCommand("git", ["push", "-u", "origin", "main"], projectPath, true);
      }
    } catch (err) {
      console.warn("git initialization warning:", err);
      // Don't fail if git operations fail
    }
  }

  // Register in opencode.json if requested
  if (input.register) {
    try {
      const opencodeJsonPath = "/home/jared/source/opencode.json";
      const opencodeContent = JSON.parse(await readFile(opencodeJsonPath, "utf8"));
      
      // Add MCP entry
      if (!opencodeContent.mcp) {
        opencodeContent.mcp = {};
      }
      
      opencodeContent.mcp[input.name] = {
        enabled: true,
        type: "local",
        command: ["bun", "run", join(projectPath, "src", "index.ts")],
        environment: {}
      };
      
      await writeFile(opencodeJsonPath, JSON.stringify(opencodeContent, null, 2), "utf8");
      files.push("(registered in opencode.json)");
    } catch (err) {
      console.warn("opencode.json registration warning:", err);
      // Don't fail if registration fails
    }
  }

  return { 
    content: [{ 
      type: "text" as const, 
      text: JSON.stringify({ 
        path: projectPath, 
        files,
        git_initialized: shouldInitGit,
        remote_url: remoteUrl || undefined,
        registered: input.register || false
      }) 
    }] 
  };
}