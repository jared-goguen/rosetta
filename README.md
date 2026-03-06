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

No runtime queries. No separate discovery step. The shared vocabulary is part of the agent from the start.

---

## What Rosetta Manages

Rosetta tracks three artifact types, each a distinct concept in the OpenCode ecosystem:

**Tools** — discrete callable units with explicit input/output schemas. The atom of agentic capability.

**Commands** — slash-command definitions. User-facing shortcuts that map to workflows, with argument schemas so agents can construct and validate invocations.

**Plugins** — composable modules that extend a host agent. Versioned, with declared dependencies.

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
```

Agents embed this at startup by pointing their MCP configuration at Rosetta. The bundle is regenerated whenever artifacts change.

---

## MCP Interface

Rosetta exposes two categories of tools: **schema tools** (read the bundle) and **authoring tools** (manage artifacts).

### Schema

#### `get_schema`
Return the full current schema bundle. This is what agents embed at startup.

```ts
// input: {}
// output: RosettaSchema
```

#### `validate`
Check that an artifact is correctly structured and its schema is parseable. Run this after authoring to confirm the bundle will reflect the change correctly.

```ts
// input
{ type: "tool" | "command" | "plugin"; name: string }

// output
{ valid: boolean; errors: string[] }
```

---

### Authoring — Tools

#### `add_tool`
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

#### `update_tool`
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

#### `remove_tool`
Delete a tool directory and all its contents.

```ts
// input: { name: string }
// output: { success: boolean }
```

#### `get_tool`
Return a tool's full definition — source, description, schema.

```ts
// input: { name: string }
// output: { name, path, content, description?, schema? }
```

#### `list_tools`
Lightweight summary of all discovered tools.

```ts
// input: {}
// output: { name: string; description?: string }[]
```

---

### Authoring — Commands

#### `add_command`

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

#### `update_command`

```ts
// input
{ name: string; content?: string; description?: string; schema?: object }
// output: { success: boolean }
```

#### `remove_command`
```ts
// input: { name: string }
// output: { success: boolean }
```

#### `get_command`
```ts
// input: { name: string }
// output: { name, path, content, description?, schema? }
```

#### `list_commands`
```ts
// input: {}
// output: { name: string; description?: string }[]
```

---

### Authoring — Plugins

#### `add_plugin`

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

#### `update_plugin`

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

#### `remove_plugin`
```ts
// input: { name: string }
// output: { success: boolean }
```

#### `get_plugin`
```ts
// input: { name: string }
// output: { name, path, manifest, content, files: string[] }
```

#### `list_plugins`
```ts
// input: {}
// output: { name: string; version: string; description?: string; enabled: boolean }[]
```

#### `enable_plugin` / `disable_plugin`
Set `enabled` in a plugin's manifest. Disabled plugins are included in the schema bundle but flagged, so agents know they exist but are not active.

```ts
// input: { name: string }
// output: { success: boolean }
```

---

## Design Principles

**The schema bundle is the product.** Everything else — the file layout, the authoring tools, the conventions — exists to produce an accurate, embeddable schema. An agent that embeds a stale or incomplete schema is operating on a lie.

**Startup-time, not runtime.** Agents do not query Rosetta during operation. They consume the schema once, at initialization. This means the bundle must be complete and correct before agents start — not eventually consistent.

**Files are the source of truth.** The disk is the registry. No database, no in-memory state that diverges from disk. Any tool that can read a file can understand a Rosetta artifact independently of the server.

**Schemas are mandatory in practice.** `schema.json` is technically optional in the file layout. In practice, an artifact without a schema contributes nothing meaningful to the bundle — it is a name with no contract. Agents cannot reason about it.

**Authoring fails safe.** `add_*` fails if the target already exists. Other agents may already have the prior schema embedded. Silent overwrites are not acceptable.

**Rosetta does not execute.** It describes capabilities and manages their definitions. Invocation is always the caller's responsibility.
