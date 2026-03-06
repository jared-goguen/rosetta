# Rosetta — Implementation Plan

## Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **MCP SDK**: `@modelcontextprotocol/sdk` (v1.27.x)
- **Schema validation**: `ajv` for validating `schema.json` files against JSON Schema draft-07
- **Transport**: stdio (standard MCP transport; agents connect via MCP client config)

---

## Testing Philosophy

Tests are written alongside each phase, not after. Every phase ships with the tests that prove it works. There are two distinct layers:

**Unit tests** — exercise individual modules (scanner, bundle generator, validator) in isolation using static fixture directories. Fast, no subprocess, no MCP transport.

**Integration tests** — spawn Rosetta as a real subprocess over stdio, call tools through the MCP client, and assert on the full chain: tool call → filesystem state → bundle contents → `get_schema` output. These are the tests that matter most, because they verify what an agent actually sees.

The core invariant that every integration test must enforce:

> After any mutation, `rosetta.schema.json` on disk and the response from `get_schema` must be identical, complete, and correct.

Tests are never mocked at the transport layer. If a test needs to call `add_tool`, it goes through the MCP server. If it wants to assert the bundle, it reads `rosetta.schema.json` off disk *and* calls `get_schema` and compares both.

---

## Repository Structure

```
rosetta/
  src/
    index.ts              # entry point — creates and starts the MCP server
    server.ts             # MCP server setup, tool registration
    scanner.ts            # filesystem scanning and autodiscovery
    bundle.ts             # schema bundle generation and writing
    validator.ts          # artifact validation logic
    tools/
      schema.ts           # get_schema
      validate.ts         # validate
      tools.ts            # add_tool, update_tool, remove_tool, get_tool, list_tools
      commands.ts         # add_command, update_command, remove_command, get_command, list_commands
      plugins.ts          # add_plugin, update_plugin, remove_plugin, get_plugin, list_plugins, enable_plugin, disable_plugin
    types.ts              # shared TypeScript interfaces
  tests/
    helpers/
      server.ts           # spawn Rosetta over stdio, wrap in a typed MCP client
      fixtures.ts         # create and tear down isolated temp artifact roots
      assert.ts           # bundle-aware assertion helpers
    fixtures/             # static artifact directories for unit tests
      valid-tool/
      valid-tool-no-schema/
      invalid-tool-no-entry/
      valid-command/
      valid-plugin/
      invalid-plugin-no-manifest/
      invalid-plugin-bad-manifest/
    unit/
      scanner.test.ts
      bundle.test.ts
      validator.test.ts
    integration/
      tools.test.ts
      commands.test.ts
      plugins.test.ts
      schema.test.ts      # full-chain round-trip tests
  artifacts/
    tools/
    commands/
    plugins/
  rosetta.schema.json
  package.json
  tsconfig.json
  bunfig.toml
```

---

## Test Helpers (written first, before any phase)

Before any phase begins, establish the three test helpers. Everything else depends on them.

### `tests/helpers/server.ts`

Spawns `bun run src/index.ts` as a subprocess with `ROSETTA_ROOT` pointed at a caller-supplied temp directory. Wraps the subprocess in the MCP SDK's `StdioClientTransport` and returns a connected `McpClient`. Exposes a `close()` method that kills the subprocess and cleans up.

```ts
interface TestServer {
  client: McpClient
  root: string          // the temp directory ROSETTA_ROOT points to
  close: () => Promise<void>
}

async function spawnServer(root: string): Promise<TestServer>
```

Each integration test gets its own server instance with its own isolated root. Tests do not share server state.

### `tests/helpers/fixtures.ts`

Creates isolated temp directories with a known artifact layout for a given test. Returns the root path. Cleans up on test teardown.

```ts
// Create an empty artifact root (tools/, commands/, plugins/ dirs)
async function makeRoot(): Promise<string>

// Seed a root with pre-built artifacts for setup-heavy tests
async function seedRoot(root: string, artifacts: SeedSpec): Promise<void>
```

### `tests/helpers/assert.ts`

Assertions that understand the bundle invariant. Every mutating integration test uses these rather than raw `expect` on the bundle shape.

```ts
// Assert a tool appears in the bundle with the expected definition
async function assertToolInBundle(root: string, client: McpClient, expected: Partial<ToolDefinition>): Promise<void>

// Assert a tool does NOT appear in the bundle
async function assertToolAbsentFromBundle(root: string, client: McpClient, name: string): Promise<void>

// The core invariant check: disk bundle === get_schema response
async function assertBundleConsistent(root: string, client: McpClient): Promise<void>
```

`assertBundleConsistent` is called at the end of every integration test, always. It reads `rosetta.schema.json` from disk and calls `get_schema` via the client and does a deep equality check. If they diverge, something is wrong with `rebuildBundle`.

---

## Phase 1 — Project Scaffold

**Goal**: Runnable MCP server that responds to the MCP handshake.

### Steps

1. `bun init`, configure TypeScript strict mode.
2. Install dependencies:
   ```
   bun add @modelcontextprotocol/sdk ajv
   bun add -d @types/node typescript
   ```
3. `tsconfig.json`: target ES2022, moduleResolution bundler, strict true.
4. `src/index.ts`: instantiate MCP server, connect stdio transport, start listening.
5. `src/server.ts`: `createServer()` returns a configured `McpServer` with no tools yet.

### Tests shipped with this phase

**`tests/helpers/server.ts`** — written now, before any other test. Verify the helper itself: `spawnServer()` connects, the client can ping, `close()` shuts down cleanly.

```ts
test("server starts and responds to ping", async () => {
  const root = await makeRoot()
  const srv = await spawnServer(root)
  // MCP SDK ping or list_tools with empty result
  const result = await srv.client.listTools()
  expect(result.tools).toEqual([])
  await srv.close()
})
```

This test will pass trivially at first but establishes that the subprocess harness works before any real tools are added.

---

## Phase 2 — Types

**Goal**: `src/types.ts` defines all shared interfaces.

```ts
interface ToolDefinition {
  name: string;
  description?: string;
  schema: { input: object; output: object } | null;
}

interface CommandDefinition {
  name: string;
  description?: string;
  schema: object | null;
}

interface PluginDefinition {
  name: string;
  version: string;
  description?: string;
  dependencies: string[];
  enabled: boolean;
}

interface RosettaSchema {
  version: string;      // schema format version, e.g. "1"
  generatedAt: string;  // ISO 8601
  tools: ToolDefinition[];
  commands: CommandDefinition[];
  plugins: PluginDefinition[];
}

interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  entry: string;
  dependencies?: string[];
  enabled?: boolean;
}

interface ToolRecord {
  name: string;
  path: string;
  content: string;
  description?: string;
  schema?: { input: object; output: object };
}

interface CommandRecord {
  name: string;
  path: string;
  content: string;
  description?: string;
  schema?: object;
}

interface PluginRecord {
  name: string;
  path: string;
  manifest: PluginManifest;
  content: string;
  files: string[];
}
```

No tests for this phase — types have no runtime behavior. The correctness of the type definitions is validated implicitly by every subsequent test that compiles.

---

## Phase 3 — Scanner

**Goal**: `src/scanner.ts` — the only place that reads the filesystem.

### API

```ts
function getRoot(): string   // reads ROSETTA_ROOT env var

async function scanTools(): Promise<ToolRecord[]>
async function scanCommands(): Promise<CommandRecord[]>
async function scanPlugins(): Promise<PluginRecord[]>

async function readTool(name: string): Promise<ToolRecord>
async function readCommand(name: string): Promise<CommandRecord>
async function readPlugin(name: string): Promise<PluginRecord>
```

### Implementation notes

- `readdir` the subdirectory, filter to entries where the required entry point exists.
- `readTool`: read `index.ts`, read `purpose.md` if present, parse `schema.json` if present.
- `readPlugin`: same, plus parse `manifest.json` (required — throw if missing or malformed).
- Schema JSON is parsed but not validated; validation is `validator.ts`'s job.
- Missing optional files → `undefined` fields, not errors.

### Tests shipped with this phase

**`tests/unit/scanner.test.ts`** — runs against static `tests/fixtures/` directories. No temp dirs, no subprocess.

```ts
test("scanTools returns valid tools from fixture root", async () => {
  process.env.ROSETTA_ROOT = path.join(__dirname, "../fixtures")
  const tools = await scanTools()
  expect(tools.find(t => t.name === "valid-tool")).toBeDefined()
})

test("scanTools excludes directories missing index.ts", async () => {
  const tools = await scanTools()
  expect(tools.find(t => t.name === "invalid-tool-no-entry")).toBeUndefined()
})

test("readTool returns content, description, and schema when all files present", async () => {
  const tool = await readTool("valid-tool")
  expect(tool.content).toBeTruthy()
  expect(tool.description).toBeTruthy()
  expect(tool.schema?.input).toBeDefined()
  expect(tool.schema?.output).toBeDefined()
})

test("readTool returns no schema when schema.json absent", async () => {
  const tool = await readTool("valid-tool-no-schema")
  expect(tool.schema).toBeUndefined()
})

test("readPlugin throws when manifest.json missing", async () => {
  await expect(readPlugin("invalid-plugin-no-manifest")).rejects.toThrow()
})
```

Equivalent tests for `scanCommands`, `scanPlugins`, `readCommand`, `readPlugin`.

---

## Phase 4 — Bundle Generator

**Goal**: `src/bundle.ts` produces and writes `rosetta.schema.json`.

### API

```ts
function generateBundle(tools: ToolRecord[], commands: CommandRecord[], plugins: PluginRecord[]): RosettaSchema

async function writeBundle(schema: RosettaSchema, root: string): Promise<void>

async function rebuildBundle(root: string): Promise<RosettaSchema>
```

### Implementation notes

- `generateBundle`: maps records to `*Definition` shapes. Strips `content` and `path` — the bundle is contracts, not implementations.
- `writeBundle`: writes to `<root>/rosetta.schema.json`, 2-space indented.
- `rebuildBundle`: `scanTools` + `scanCommands` + `scanPlugins` → `generateBundle` → `writeBundle`.

### Tests shipped with this phase

**`tests/unit/bundle.test.ts`** — pure unit tests, no filesystem writes.

```ts
test("generateBundle maps tool records to definitions, stripping source content", () => {
  const tools: ToolRecord[] = [{ name: "foo", path: "/x", content: "code", description: "desc", schema: { input: {}, output: {} } }]
  const bundle = generateBundle(tools, [], [])
  expect(bundle.tools[0]).toEqual({ name: "foo", description: "desc", schema: { input: {}, output: {} } })
  expect((bundle.tools[0] as any).content).toBeUndefined()
})

test("generateBundle includes tools with null schema when schema.json absent", () => {
  const tools: ToolRecord[] = [{ name: "bare", path: "/x", content: "code" }]
  const bundle = generateBundle(tools, [], [])
  expect(bundle.tools[0].schema).toBeNull()
})

test("generateBundle sets version and generatedAt", () => {
  const bundle = generateBundle([], [], [])
  expect(bundle.version).toBe("1")
  expect(new Date(bundle.generatedAt).getTime()).not.toBeNaN()
})

test("writeBundle writes valid JSON to rosetta.schema.json", async () => {
  const root = await makeRoot()
  const bundle = generateBundle([], [], [])
  await writeBundle(bundle, root)
  const written = JSON.parse(await Bun.file(path.join(root, "rosetta.schema.json")).text())
  expect(written.version).toBe("1")
})
```

---

## Phase 5 — Validator

**Goal**: `src/validator.ts` — pure reads, no side effects, `ajv`-backed JSON Schema checking.

### API

```ts
interface ValidationResult { valid: boolean; errors: string[] }

async function validateTool(name: string, root: string): Promise<ValidationResult>
async function validateCommand(name: string, root: string): Promise<ValidationResult>
async function validatePlugin(name: string, root: string): Promise<ValidationResult>
```

### Checks

**Tool / Command**: directory exists, `index.ts` present and non-empty, if `schema.json` present: valid JSON, correct shape, each sub-schema passes `ajv` validation.

**Plugin**: directory exists, `index.ts` non-empty, `manifest.json` present and parseable, required manifest fields (`name`, `version`, `entry`) present, `entry` file exists, `dependencies` if present is `string[]`.

### Tests shipped with this phase

**`tests/unit/validator.test.ts`** — runs against static fixtures.

```ts
test("validateTool returns valid for a well-formed tool", async () => {
  const result = await validateTool("valid-tool", fixturesRoot)
  expect(result.valid).toBe(true)
  expect(result.errors).toEqual([])
})

test("validateTool reports error when index.ts missing", async () => {
  const result = await validateTool("invalid-tool-no-entry", fixturesRoot)
  expect(result.valid).toBe(false)
  expect(result.errors).toContain(expect.stringMatching(/index\.ts/))
})

test("validatePlugin reports error when manifest.json missing required field", async () => {
  const result = await validatePlugin("invalid-plugin-bad-manifest", fixturesRoot)
  expect(result.valid).toBe(false)
  expect(result.errors.some(e => e.includes("version"))).toBe(true)
})

test("validateTool reports error when schema.json input is not a valid JSON Schema", async () => {
  // fixture: schema.json with input: "not an object"
  const result = await validateTool("invalid-tool-bad-schema", fixturesRoot)
  expect(result.valid).toBe(false)
})
```

---

## Phase 6 — MCP Tool Handlers

**Goal**: All tool handlers implemented and registered. Each handler calls `rebuildBundle()` after any mutation.

### Registration pattern

```ts
server.tool("add_tool", AddToolInputSchema, handlers.addTool)
```

Handlers return `{ content: [{ type: "text", text: JSON.stringify(result) }] }`. Input schemas are Zod objects defined alongside each handler.

### Tests shipped with this phase

Integration tests — one file per artifact type. Each test spins up a fresh server with an isolated root.

**Pattern applied to every mutating test:**

```ts
test("add_tool creates files on disk and updates the bundle", async () => {
  const root = await makeRoot()
  const srv = await spawnServer(root)

  await srv.client.callTool("add_tool", {
    name: "my-tool",
    content: "export function run() {}",
    description: "does a thing",
    schema: { input: { type: "object" }, output: { type: "string" } }
  })

  // 1. Filesystem state
  expect(await Bun.file(path.join(root, "tools/my-tool/index.ts")).exists()).toBe(true)
  expect(await Bun.file(path.join(root, "tools/my-tool/purpose.md")).exists()).toBe(true)
  expect(await Bun.file(path.join(root, "tools/my-tool/schema.json")).exists()).toBe(true)

  // 2. Bundle on disk reflects the new tool
  const bundle = JSON.parse(await Bun.file(path.join(root, "rosetta.schema.json")).text())
  expect(bundle.tools.find((t: any) => t.name === "my-tool")).toBeDefined()

  // 3. Core invariant: disk bundle === get_schema
  await assertBundleConsistent(root, srv.client)

  await srv.close()
})
```

**`tests/integration/tools.test.ts`** covers:
- `add_tool` — happy path (above)
- `add_tool` — duplicate name returns error, filesystem unchanged, bundle unchanged
- `get_tool` — returns content, description, schema
- `get_tool` — unknown name returns error
- `update_tool` — content only: updates `index.ts`, leaves `schema.json` untouched, bundle reflects new description
- `update_tool` — schema only: `index.ts` untouched, bundle reflects new schema
- `remove_tool` — directory gone, bundle no longer contains tool
- `remove_tool` — unknown name returns error
- `list_tools` — returns all tools, no more
- Multi-step sequence: add → update → remove → assert bundle empty of that tool at each step

**`tests/integration/commands.test.ts`** — mirrors tools tests for command semantics.

**`tests/integration/plugins.test.ts`** covers the above plus:
- `enable_plugin` / `disable_plugin` — manifest updated, bundle `enabled` field reflects change, `assertBundleConsistent` passes
- `add_plugin` with `files` — `src/` subdirectory populated correctly
- `update_plugin` manifest deep-merge — existing manifest fields not overwritten unless explicitly provided

**`tests/integration/schema.test.ts`** — cross-cutting tests that don't fit neatly into one artifact type:

```ts
test("get_schema on empty root returns empty bundle with correct shape", async () => {
  const root = await makeRoot()
  const srv = await spawnServer(root)
  const result = await srv.client.callTool("get_schema", {})
  const schema: RosettaSchema = JSON.parse(result.content[0].text)
  expect(schema.tools).toEqual([])
  expect(schema.commands).toEqual([])
  expect(schema.plugins).toEqual([])
  expect(schema.version).toBe("1")
  await assertBundleConsistent(root, srv.client)
  await srv.close()
})

test("get_schema reflects multiple artifact types in a single bundle", async () => {
  const root = await makeRoot()
  const srv = await spawnServer(root)
  await srv.client.callTool("add_tool", { name: "t1", content: "x", schema: { input: {}, output: {} } })
  await srv.client.callTool("add_command", { name: "c1", content: "x" })
  await srv.client.callTool("add_plugin", { name: "p1", content: "x", manifest: { version: "1.0.0", entry: "index.ts" } })
  await assertBundleConsistent(root, srv.client)
  const bundle = JSON.parse(await Bun.file(path.join(root, "rosetta.schema.json")).text())
  expect(bundle.tools).toHaveLength(1)
  expect(bundle.commands).toHaveLength(1)
  expect(bundle.plugins).toHaveLength(1)
  await srv.close()
})

test("validate returns valid after add_tool", async () => {
  const root = await makeRoot()
  const srv = await spawnServer(root)
  await srv.client.callTool("add_tool", { name: "t1", content: "x", schema: { input: {}, output: {} } })
  const result = await srv.client.callTool("validate", { type: "tool", name: "t1" })
  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.valid).toBe(true)
  expect(parsed.errors).toEqual([])
  await srv.close()
})
```

---

## Phase 7 — Error Handling

All handlers use a uniform error contract:

- **Not found**: `McpError` with `ErrorCode.InvalidParams`
- **Already exists**: `McpError` with `ErrorCode.InvalidParams`
- **Malformed input**: `McpError` with `ErrorCode.InvalidParams`
- **Filesystem error**: `McpError` with `ErrorCode.InternalError`, original message preserved

No handler swallows errors silently.

### Tests shipped with this phase

Error cases are already part of the integration tests in Phase 6. No separate test file. What this phase adds is verifying that errors are surfaced correctly through the MCP transport — that the client receives an `McpError` rather than a malformed success response.

```ts
test("add_tool with duplicate name returns McpError, not success", async () => {
  const root = await makeRoot()
  const srv = await spawnServer(root)
  await srv.client.callTool("add_tool", { name: "t1", content: "x" })
  await expect(srv.client.callTool("add_tool", { name: "t1", content: "x" }))
    .rejects.toThrow(McpError)
  // filesystem unchanged — only one copy exists
  const bundle = JSON.parse(await Bun.file(path.join(root, "rosetta.schema.json")).text())
  expect(bundle.tools.filter((t: any) => t.name === "t1")).toHaveLength(1)
  await srv.close()
})
```

---

## Phase 8 — Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ROSETTA_ROOT` | cwd | Root for artifact directories and bundle output |
| `ROSETTA_BUNDLE_PATH` | `<ROSETTA_ROOT>/rosetta.schema.json` | Override bundle output path |

No config file. The test harness sets `ROSETTA_ROOT` per-test to an isolated temp directory — this is what makes tests not interfere with each other and not pollute the working tree.

---

## Implementation Order

| Phase | Deliverable | Depends on | Tests |
|-------|-------------|------------|-------|
| 0 | Test helpers (`server.ts`, `fixtures.ts`, `assert.ts`) | — | Harness smoke test |
| 1 | Server scaffold | — | Subprocess ping |
| 2 | `types.ts` | — | None (compile-time) |
| 3 | `scanner.ts` | 2 | `unit/scanner.test.ts` |
| 4 | `bundle.ts` | 2, 3 | `unit/bundle.test.ts` |
| 5 | `validator.ts` | 2, 3 | `unit/validator.test.ts` |
| 6a | Tool handlers (tools) | 3, 4, 5 | `integration/tools.test.ts`, `integration/schema.test.ts` |
| 6b | Tool handlers (commands) | 3, 4, 5 | `integration/commands.test.ts` |
| 6c | Tool handlers (plugins) | 3, 4, 5 | `integration/plugins.test.ts` |
| 7 | Error handling | 6 | Error cases in existing integration tests |
| 8 | Configuration | 1 | Verified implicitly by all integration tests via `ROSETTA_ROOT` |

Phases 3, 4, 5 run in parallel once Phase 2 is done. Phases 6a, 6b, 6c run in parallel once 3–5 are done. `assertBundleConsistent` runs at the close of every integration test — if it ever fails, the build fails.
