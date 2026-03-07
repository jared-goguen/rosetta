import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "serve-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeTool(
  toolsDir: string,
  name: string,
  opts: {
    handler: string;
    purpose?: string;
    schema?: object;
  },
) {
  const dir = join(toolsDir, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.ts"), opts.handler, "utf8");
  if (opts.purpose)
    await writeFile(join(dir, "purpose.md"), opts.purpose, "utf8");
  if (opts.schema)
    await writeFile(
      join(dir, "schema.json"),
      JSON.stringify(opts.schema),
      "utf8",
    );
}

// Create a minimal project that uses the convention server
async function makeProject(
  toolDefs: Array<{
    name: string;
    handler: string;
    purpose?: string;
    schema?: object;
  }>,
) {
  const toolsDir = join(root, "tools");
  await mkdir(toolsDir, { recursive: true });

  for (const def of toolDefs) {
    await writeTool(toolsDir, def.name, def);
  }

  // Write a minimal entry point that imports serve.ts from rosetta/lib
  const servePath = join(
    new URL("../../lib/serve.ts", import.meta.url).pathname,
  );
  const entryCode = `
    import { startServer } from "${servePath}";
    await startServer({ name: "test", version: "0.0.1", toolsDir: "${toolsDir}" });
  `;
  const entryPath = join(root, "entry.ts");
  await writeFile(entryPath, entryCode, "utf8");

  return entryPath;
}

async function spawnAndConnect(entryPath: string) {
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", entryPath],
  });
  const client = new Client({ name: "serve-test", version: "0.0.1" });
  await client.connect(transport);
  return client;
}

describe("convention server", () => {
  test("discovers a tool and lists it", async () => {
    const entry = await makeProject([
      {
        name: "echo",
        handler: `export async function echo(input) {
          return { content: [{ type: "text", text: JSON.stringify(input) }] };
        }`,
        purpose: "Echo the input back.\nMore details here.",
        schema: {
          input: {
            type: "object",
            properties: { msg: { type: "string" } },
            required: ["msg"],
          },
        },
      },
    ]);

    const client = await spawnAndConnect(entry);
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("echo");
      expect(tools[0].description).toBe("Echo the input back.");
      expect(tools[0].inputSchema).toEqual({
        type: "object",
        properties: { msg: { type: "string" } },
        required: ["msg"],
      });
    } finally {
      await client.close();
    }
  });

  test("calls a tool and returns its result", async () => {
    const entry = await makeProject([
      {
        name: "greet",
        handler: `export async function greet(input) {
          return { content: [{ type: "text", text: "hello " + input.name }] };
        }`,
      },
    ]);

    const client = await spawnAndConnect(entry);
    try {
      const result = await client.callTool({
        name: "greet",
        arguments: { name: "world" },
      });
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toBe("hello world");
    } finally {
      await client.close();
    }
  });

  test("returns error for unknown tool", async () => {
    const entry = await makeProject([]);

    const client = await spawnAndConnect(entry);
    try {
      await expect(
        client.callTool({ name: "nope", arguments: {} }),
      ).rejects.toThrow();
    } finally {
      await client.close();
    }
  });

  test("handler errors are returned as isError responses", async () => {
    const entry = await makeProject([
      {
        name: "fail",
        handler: `export async function fail() {
          throw new Error("deliberate failure");
        }`,
      },
    ]);

    const client = await spawnAndConnect(entry);
    try {
      const result = await client.callTool({ name: "fail", arguments: {} });
      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("deliberate failure");
    } finally {
      await client.close();
    }
  });

  test("tool with no schema.json gets empty object schema", async () => {
    const entry = await makeProject([
      {
        name: "bare",
        handler: `export async function bare() {
          return { content: [{ type: "text", text: "ok" }] };
        }`,
      },
    ]);

    const client = await spawnAndConnect(entry);
    try {
      const { tools } = await client.listTools();
      expect(tools[0].inputSchema).toEqual({ type: "object" });
    } finally {
      await client.close();
    }
  });

  test("discovers multiple tools", async () => {
    const entry = await makeProject([
      {
        name: "beta",
        handler: `export async function beta() { return { content: [{ type: "text", text: "b" }] }; }`,
      },
      {
        name: "alpha",
        handler: `export async function alpha() { return { content: [{ type: "text", text: "a" }] }; }`,
      },
    ]);

    const client = await spawnAndConnect(entry);
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(2);
      // Both discovered regardless of order
      expect(tools.map((t) => t.name).sort()).toEqual(["alpha", "beta"]);
    } finally {
      await client.close();
    }
  });

  test("skips directories without index.ts", async () => {
    const toolsDir = join(root, "tools");
    await mkdir(join(toolsDir, "no-index"), { recursive: true });
    await writeFile(
      join(toolsDir, "no-index", "purpose.md"),
      "I have no handler",
      "utf8",
    );

    const entry = await makeProject([
      {
        name: "real",
        handler: `export async function real() { return { content: [{ type: "text", text: "ok" }] }; }`,
      },
    ]);

    const client = await spawnAndConnect(entry);
    try {
      const { tools } = await client.listTools();
      // Only "real" should be discovered, not "no-index"
      expect(tools.map((t) => t.name)).toContain("real");
      expect(tools.map((t) => t.name)).not.toContain("no-index");
    } finally {
      await client.close();
    }
  });
});
