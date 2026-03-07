# Rosetta

A schema registry and MCP authoring server. Every agent embeds the Rosetta schema at startup — so agents are born knowing the full capability surface of the ecosystem, not discovering it at runtime.

---

## The Core Idea

In a multi-agent system, each agent has capabilities. The problem is that these capabilities are opaque: one agent cannot know what another can do, what inputs it expects, or what it returns — unless that information is baked in ahead of time.

Rosetta solves this by maintaining a **canonical schema bundle** — a typed, machine-readable description of every tool, command, and plugin in the ecosystem. Agents embed this bundle at startup. From the moment an agent initializes, it already knows:

- What tools exist and what they do
- What each tool accepts and returns
- What commands are available and how to invoke them
- What plugins are registered and what they provide
- What MCP servers exist and which tools they expose

No runtime queries. No separate discovery step. The shared vocabulary is part of the agent from the start.

---

## What Rosetta Manages

Rosetta tracks four artifact types, each a distinct concept in the OpenCode ecosystem:

**Tools** — discrete callable units with explicit input/output schemas. The atom of agentic capability.

**Commands** — slash-command definitions. User-facing shortcuts that map to workflows, with argument schemas so agents can construct and validate invocations.

**Plugins** — composable modules that extend a host agent. Versioned, with declared dependencies. Plugins live in `.opencode/plugins/` and are loaded at OpenCode startup.

**Servers** — MCP server registry. External servers that provide tools, enabling cross-server composition and discovery.

---

## File Layout

All artifacts live on disk in a convention-based structure. Rosetta derives the schema bundle from these files — no separate registration step.

```
<root>/
  tools/
    <name>/
      index.ts        # implementation entry point
      purpose.md      # description (becomes schema summary)
      schema.json     # JSON Schema for inputs and outputs
  commands/
    <name>/
      index.ts        # command implementation
      purpose.md      # description
      schema.json     # argument schema
  plugins/
    <name>/
      manifest.json   # name, version, description, entry, dependencies
      index.ts        # plugin entry point
      src/            # additional source (optional)
  servers/
    <name>.yaml       # server metadata (name, type, location/url, tools)
```

An artifact is valid and included in the schema bundle when its directory exists and its entry point is present. `schema.json` / `manifest.json` are what make the bundle meaningful — without typed schemas, agents embed a list of names; with them, they embed a contract.

---

## The Schema Bundle

Rosetta produces a single schema bundle that agents consume at startup. It is the authoritative snapshot of the ecosystem at a point in time.

```ts
interface RosettaSchema {
  version: string;
  generatedAt: string;
  tools: ToolDefinition[];
  commands: CommandDefinition[];
  plugins: PluginDefinition[];
  servers: ServerDefinition[];
}

interface ToolDefinition {
  name: string;
  description?: string;
  input: object;   // JSON Schema
  output: object;  // JSON Schema
}

interface CommandDefinition {
  name: string;
  description?: string;
  arguments: object;  // JSON Schema
}

interface PluginDefinition {
  name: string;
  version: string;
  description?: string;
  dependencies: string[];
  enabled: boolean;
}

interface ServerDefinition {
  name: string;
  type: "local" | "remote";
  location?: string;     // path for local servers
  url?: string;          // URL for remote servers
  description?: string;
  tools: string[];       // tool names provided
  enabled: boolean;
}
```

Agents embed this at startup by pointing their MCP configuration at Rosetta. The bundle is regenerated whenever artifacts change.

---

## MCP Interface

Rosetta exposes two categories of tools: **schema tools** (read the bundle) and **authoring tools** (manage artifacts).

### Schema

#### `rosetta_get_schema`
Return the full current schema bundle. This is what agents embed at startup.

```ts
// input: {}
// output: RosettaSchema
```

#### `rosetta_validate`
Check that an artifact is correctly structured and its schema is parseable.

```ts
// input
{ type: "tool" | "command" | "plugin"; name: string }

// output
{ valid: boolean; errors: string[] }
```

---

### Authoring — Tools

#### `rosetta_add_tool`
Scaffold a new tool directory. Fails if the name already exists.

```ts
// input
{
  name: string;
  content: string;       // index.ts source
  description?: string;  // written to purpose.md
  schema?: {
    input: object;
    output: object;
  };
}
// output: { path: string }
```

#### `rosetta_update_tool`
Overwrite specific files in an existing tool. Omitted fields are untouched.

```ts
// input
{
  name: string;
  content?: string;
  description?: string;
  schema?: { input?: object; output?: object };
}
// output: { success: boolean }
```

#### `rosetta_remove_tool`
Delete a tool directory and all its contents.

```ts
// input: { name: string }
// output: { success: boolean }
```

#### `rosetta_get_tool`
Return a tool's full definition — source, description, schema.

```ts
// input: { name: string }
// output: { name, path, content, description?, schema? }
```

#### `rosetta_list_tools`
Lightweight summary of all discovered tools.

```ts
// input: {}
// output: { name: string; description?: string }[]
```

---

### Authoring — Commands

#### `rosetta_add_command`

```ts
// input
{
  name: string;
  content: string;
  description?: string;
  schema?: object;  // argument schema
}
// output: { path: string }
```

#### `rosetta_update_command`

```ts
// input: { name: string; content?: string; description?: string; schema?: object }
// output: { success: boolean }
```

#### `rosetta_remove_command`
```ts
// input: { name: string }
// output: { success: boolean }
```

#### `rosetta_get_command`
```ts
// input: { name: string }
// output: { name, path, content, description?, schema? }
```

#### `rosetta_list_commands`
```ts
// input: {}
// output: { name: string; description?: string }[]
```

---

### Authoring — Plugins

#### `rosetta_add_plugin`

```ts
// input
{
  name: string;
  content: string;
  manifest: {
    version: string;
    description?: string;
    dependencies?: string[];
  };
  files?: Record<string, string>;  // path → content, placed under src/
}
// output: { path: string }
```

#### `rosetta_update_plugin`

```ts
// input
{
  name: string;
  content?: string;
  manifest?: Partial<PluginManifest>;
  files?: Record<string, string>;
}
// output: { success: boolean }
```

#### `rosetta_remove_plugin`
```ts
// input: { name: string }
// output: { success: boolean }
```

#### `rosetta_get_plugin`
```ts
// input: { name: string }
// output: { name, path, manifest, content, files: string[] }
```

#### `rosetta_list_plugins`
```ts
// input: {}
// output: { name: string; version: string; description?: string; enabled: boolean }[]
```

#### `rosetta_enable_plugin` / `rosetta_disable_plugin`
Set `enabled` in a plugin's manifest. Disabled plugins are included in the schema bundle but flagged.

```ts
// input: { name: string }
// output: { success: boolean }
```

---

### Server Registry

Rosetta catalogs external MCP servers to enable cross-server tool discovery and composition. Servers are registered via YAML files in `servers/` and included in the schema bundle.

#### `rosetta_register_server`
Register or update an MCP server in the catalog.

```ts
// input
{
  name: string;
  type: "local" | "remote";
  location?: string;     // required for local servers
  url?: string;          // required for remote servers
  description?: string;
  tools: string[];       // tool names provided
  enabled?: boolean;     // default: true
}
// output: { success: boolean; server: ServerDefinition }
```

#### `rosetta_list_servers`
```ts
// input: {}
// output: { name, type, description?, enabled, tools }[]
```

#### `rosetta_get_server`
```ts
// input: { name: string }
// output: ServerDefinition
```

**Use case:** Agents query `rosetta_list_servers` to discover the ecosystem, then call cross-server tools using the naming convention `<server>_<tool>` (e.g., `gutenberg_render_page`, `flowbot_start_flow`).

---

### Server Scaffolding

#### `rosetta_create_server`
Scaffold a complete new MCP server project following Rosetta conventions.

```ts
// input
{
  name: string;       // lowercase-hyphenated, becomes directory name
  directory: string;  // parent directory to create the server in
  tools?: string[];   // initial tool names to scaffold
  dependencies?: string[];
}
// output: { path: string }
```

The scaffolded project includes: `src/index.ts`, `src/serve.ts`, `package.json`, `tsconfig.json`, `bun.lockb`, `tests/` harness, and empty tool directories for each named tool.

---

## Flows

Rosetta includes a `flows/` directory of Flowbot-compatible workflow definitions for building new servers.

### `flows/new_server.yaml`

A 9-state flow for building any MCP server under enforcement:

| State | Permissions |
|---|---|
| `gathering` | `rosetta_read` |
| `researching` | `rosetta_read`, `filesystem`, `runtime` |
| `scaffolding` | `rosetta_scaffold`, `rosetta_read`, `filesystem` |
| `implementing_shared` | `rosetta_read`, `rosetta_write`, `filesystem`, `runtime` |
| `implementing_tools` | `rosetta_read`, `rosetta_write`, `filesystem` |
| `validating_unit` | `rosetta_read`, `filesystem`, `runtime` |
| `validating_integration` | `rosetta_read`, `filesystem`, `runtime` |
| `debugging` | `rosetta_read`, `rosetta_write`, `filesystem`, `runtime` |
| `configuring` | `filesystem`, `runtime` |
| `complete` | *(none — read-only terminal state)* |

To use: start a flow instance with Flowbot, write the instance path to `.opencode/flowguard.active`, and the FlowGuard plugin will enforce the permissions for each state automatically.

---

## Design Principles

**The schema bundle is the product.** Everything else — the file layout, the authoring tools, the conventions — exists to produce an accurate, embeddable schema. An agent that embeds a stale or incomplete schema is operating on a lie.

**Startup-time, not runtime.** Agents do not query Rosetta during operation. They consume the schema once, at initialization. This means the bundle must be complete and correct before agents start — not eventually consistent.

**Files are the source of truth.** The disk is the registry. No database, no in-memory state that diverges from disk. Any tool that can read a file can understand a Rosetta artifact independently of the server.

**Schemas are mandatory in practice.** `schema.json` is technically optional in the file layout. In practice, an artifact without a schema contributes nothing meaningful to the bundle — it is a name with no contract.

**Authoring fails safe.** `rosetta_add_*` fails if the target already exists. Other agents may already have the prior schema embedded. Silent overwrites are not acceptable.

**Rosetta does not execute.** It describes capabilities and manages their definitions. Invocation is always the caller's responsibility.
