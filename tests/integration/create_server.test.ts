import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { stat, readFile } from "fs/promises";
import { makeRoot, cleanRoot } from "../helpers/fixtures.js";
import { spawnServer, type TestServer } from "../helpers/server.js";
// create_server doesn't modify the rosetta server itself, so no bundle consistency checks needed

let srv: TestServer;
let testRoot: string;

beforeEach(async () => {
  const root = await makeRoot();
  srv = await spawnServer(root);
  testRoot = await makeRoot(); // Separate directory for generated projects
});

afterEach(async () => {
  const root = srv.root;
  await srv.close();
  await cleanRoot(root);
  await cleanRoot(testRoot);
});

describe("create_server", () => {
  test("creates basic project structure", async () => {
    const result = await srv.call("create_server", { 
      name: "test-server", 
      directory: testRoot 
    });

    const projectPath = join(testRoot, "test-server");
    const resultData = JSON.parse(result);
    expect(resultData.path).toBe(projectPath);
    expect(resultData.files).toContain("package.json");
    expect(resultData.files).toContain("src/index.ts");
    expect(resultData.files).toContain("src/serve.ts");

    // Check files exist
    expect(await stat(join(projectPath, "package.json"))).toBeTruthy();
    expect(await stat(join(projectPath, "src/index.ts"))).toBeTruthy();
    expect(await stat(join(projectPath, "src/serve.ts"))).toBeTruthy();
    expect(await stat(join(projectPath, "tsconfig.json"))).toBeTruthy();
    expect(await stat(join(projectPath, "tests/helpers/server.ts"))).toBeTruthy();
    expect(await stat(join(projectPath, "tests/helpers/fixtures.ts"))).toBeTruthy();
    expect(await stat(join(projectPath, "tools"))).toBeTruthy();
  });

  test("creates project with custom dependencies", async () => {
    await srv.call("create_server", { 
      name: "test-server", 
      directory: testRoot,
      dependencies: ["yaml", "lodash"]
    });

    const packageJsonPath = join(testRoot, "test-server", "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    
    expect(packageJson.dependencies).toHaveProperty("yaml");
    expect(packageJson.dependencies).toHaveProperty("lodash");
    expect(packageJson.dependencies).toHaveProperty("@modelcontextprotocol/sdk");
  });

  test("creates project with initial tools", async () => {
    await srv.call("create_server", { 
      name: "test-server", 
      directory: testRoot,
      tools: ["my-tool", "another-tool"]
    });

    const projectPath = join(testRoot, "test-server");
    
    // Check tool directories exist
    expect(await stat(join(projectPath, "tools/my-tool"))).toBeTruthy();
    expect(await stat(join(projectPath, "tools/another-tool"))).toBeTruthy();
    
    // Check tool files exist
    expect(await stat(join(projectPath, "tools/my-tool/index.ts"))).toBeTruthy();
    expect(await stat(join(projectPath, "tools/my-tool/purpose.md"))).toBeTruthy();
    expect(await stat(join(projectPath, "tools/my-tool/schema.json"))).toBeTruthy();
    
    expect(await stat(join(projectPath, "tools/another-tool/index.ts"))).toBeTruthy();
    expect(await stat(join(projectPath, "tools/another-tool/purpose.md"))).toBeTruthy();
    expect(await stat(join(projectPath, "tools/another-tool/schema.json"))).toBeTruthy();
  });

  test("fails if directory already exists", async () => {
    // Create the directory first
    await srv.call("create_server", { 
      name: "test-server", 
      directory: testRoot 
    });

    // Try to create again
    await expect(srv.call("create_server", { 
      name: "test-server", 
      directory: testRoot 
    })).rejects.toThrow();
  });

  test("generated package.json has correct structure", async () => {
    await srv.call("create_server", { 
      name: "my-awesome-server", 
      directory: testRoot 
    });

    const packageJsonPath = join(testRoot, "my-awesome-server", "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

    expect(packageJson.name).toBe("my-awesome-server");
    expect(packageJson.version).toBe("1.0.0");
    expect(packageJson.type).toBe("module");
    expect(packageJson.main).toBe("src/index.js");
    expect(packageJson.scripts).toHaveProperty("start");
    expect(packageJson.scripts).toHaveProperty("test");
    expect(packageJson.dependencies).toHaveProperty("@modelcontextprotocol/sdk");
    expect(packageJson.devDependencies).toHaveProperty("typescript");
  });

  test("generated src/index.ts is executable", async () => {
    await srv.call("create_server", { 
      name: "test-server", 
      directory: testRoot 
    });

    const indexPath = join(testRoot, "test-server", "src", "index.ts");
    const indexContent = await readFile(indexPath, "utf8");

    expect(indexContent).toContain("#!/usr/bin/env bun");
    expect(indexContent).toContain("startServer");
    expect(indexContent).toContain("test-server");
  });

  test("generated tool files have correct content", async () => {
    await srv.call("create_server", { 
      name: "test-server", 
      directory: testRoot,
      tools: ["test-tool"]
    });

    const toolIndexPath = join(testRoot, "test-server", "tools", "test-tool", "index.ts");
    const toolPurposePath = join(testRoot, "test-server", "tools", "test-tool", "purpose.md");
    const toolSchemaPath = join(testRoot, "test-server", "tools", "test-tool", "schema.json");

    const toolIndex = await readFile(toolIndexPath, "utf8");
    const toolPurpose = await readFile(toolPurposePath, "utf8");
    const toolSchema = JSON.parse(await readFile(toolSchemaPath, "utf8"));

    expect(toolIndex).toContain("export async function handler");
    expect(toolIndex).toContain("not yet implemented");
    expect(toolPurpose).toContain("TODO: Describe what the test-tool tool does");
    expect(toolSchema).toHaveProperty("input");
    expect(toolSchema).toHaveProperty("output");
  });
});