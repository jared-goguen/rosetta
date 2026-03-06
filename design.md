# MCP Builder — Design

## Overview

`mcp-builder` is an MCP server that exposes tools for creating, reading, updating, and removing tools, commands, and plugins. All artifacts are represented as files on disk. The server **autodiscovers** them at startup and on demand by scanning well-known directories using a convention-based layout; no registry or database is required.

---

## Convention-Based File Layout

```
<root>/
  tools/
    <tool-name>/
      index.ts        # required — implementation entry point
      purpose.md      # optional — human-readable description
      schema.json     # optional — JSON Schema for tool inputs
  commands/
    <command-name>/
      index.ts        # required — implementation entry point
      purpose.md      # optional — description and usage notes
  plugins/
    <plugin-name>/
      manifest.json   # required — name, version, entry, description
      index.ts        # required — plugin entry point
      src/            # optional — additional source files
```

A tool/command/plugin is considered **valid** and will be autodiscovered if its directory exists and its required entry point file is present.

---

## Autodiscovery

The server scans each convention directory on startup and exposes every discovered artifact. Scans are also triggered on demand via the `discover` tool. No explicit registration step is needed — dropping a correctly structured directory into `tools/`, `commands/`, or `plugins/` is sufficient.

---

## Tool Interface

### Tools

#### `add_tool`
Create a new tool directory and populate it with the required files.

- **Input**
  ```ts
  {
    name: string;          // directory name under tools/
    content: string;       // source for index.ts
    description?: string;  // written to purpose.md if provided
    schema?: object;       // written to schema.json if provided
  }
  ```
- **Output** `{ success: boolean; path: string }`

---

#### `remove_tool`
Delete a tool directory and all its contents.

- **Input** `{ name: string }`
- **Output** `{ success: boolean }`

---

#### `get_tool`
Return the content and metadata of a tool.

- **Input** `{ name: string }`
- **Output**
  ```ts
  {
    name: string;
    path: string;
    content: string;        // contents of index.ts
    description?: string;   // contents of purpose.md
    schema?: object;        // parsed schema.json
  }
  ```

---

#### `update_tool`
Overwrite one or more files inside an existing tool directory.

- **Input**
  ```ts
  {
    name: string;
    content?: string;      // new source for index.ts
    description?: string;  // new contents for purpose.md
    schema?: object;       // new schema.json
  }
  ```
- **Output** `{ success: boolean }`

---

#### `list_tools`
Return a summary of all autodiscovered tools.

- **Input** `{}` _(no parameters)_
- **Output** `Array<{ name: string; path: string; description?: string }>`

---

### Commands

#### `add_command`
Create a new command directory.

- **Input**
  ```ts
  {
    name: string;
    content: string;       // source for index.ts
    description?: string;  // written to purpose.md
  }
  ```
- **Output** `{ success: boolean; path: string }`

---

#### `remove_command`
Delete a command directory.

- **Input** `{ name: string }`
- **Output** `{ success: boolean }`

---

#### `get_command`
Return the content and metadata of a command.

- **Input** `{ name: string }`
- **Output**
  ```ts
  {
    name: string;
    path: string;
    content: string;
    description?: string;
  }
  ```

---

#### `update_command`
Overwrite files inside an existing command directory.

- **Input**
  ```ts
  {
    name: string;
    content?: string;
    description?: string;
  }
  ```
- **Output** `{ success: boolean }`

---

#### `list_commands`
Return a summary of all autodiscovered commands.

- **Input** `{}`
- **Output** `Array<{ name: string; path: string; description?: string }>`

---

#### `run_command`
Execute a command by name, passing optional arguments.

- **Input**
  ```ts
  {
    name: string;
    args?: Record<string, unknown>;
  }
  ```
- **Output** `{ result: unknown }`

---

### Plugins

#### `add_plugin`
Create a new plugin directory with a manifest and entry point.

- **Input**
  ```ts
  {
    name: string;
    content: string;        // source for index.ts
    manifest: {
      version: string;
      description?: string;
      dependencies?: string[];
    };
    files?: Record<string, string>; // additional paths → contents under src/
  }
  ```
- **Output** `{ success: boolean; path: string }`

---

#### `remove_plugin`
Delete a plugin directory.

- **Input** `{ name: string }`
- **Output** `{ success: boolean }`

---

#### `get_plugin`
Return a plugin's manifest, entry point, and file listing.

- **Input** `{ name: string }`
- **Output**
  ```ts
  {
    name: string;
    path: string;
    manifest: PluginManifest;
    content: string;   // contents of index.ts
    files: string[];   // relative paths of all files in the directory
  }
  ```

---

#### `update_plugin`
Update a plugin's manifest or source files.

- **Input**
  ```ts
  {
    name: string;
    content?: string;
    manifest?: Partial<PluginManifest>;
    files?: Record<string, string>;
  }
  ```
- **Output** `{ success: boolean }`

---

#### `list_plugins`
Return a summary of all autodiscovered plugins.

- **Input** `{}`
- **Output** `Array<{ name: string; path: string; version: string; description?: string }>`

---

#### `enable_plugin`
Mark a plugin as active (writes `enabled: true` to its manifest).

- **Input** `{ name: string }`
- **Output** `{ success: boolean }`

---

#### `disable_plugin`
Mark a plugin as inactive (writes `enabled: false` to its manifest).

- **Input** `{ name: string }`
- **Output** `{ success: boolean }`

---

### Utility

#### `discover`
Trigger a full rescan of all convention directories and return the complete inventory.

- **Input** `{}`
- **Output**
  ```ts
  {
    tools:    Array<{ name: string; path: string; description?: string }>;
    commands: Array<{ name: string; path: string; description?: string }>;
    plugins:  Array<{ name: string; path: string; version: string; description?: string }>;
  }
  ```

---

#### `validate`
Check whether a given artifact conforms to its convention (required files present, manifest parseable, etc.).

- **Input**
  ```ts
  {
    type: "tool" | "command" | "plugin";
    name: string;
  }
  ```
- **Output** `{ valid: boolean; errors: string[] }`

---

## Shared Type Definitions

```ts
interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  entry: string;           // relative path to entry point, e.g. "index.ts"
  dependencies?: string[];
  enabled?: boolean;
}
```

---

## Design Principles

1. **Files are the source of truth.** No in-memory registry persists across restarts.
2. **Convention over configuration.** A correctly structured directory is all that is required; no explicit registration call.
3. **Additive operations are idempotent.** `add_tool` / `add_command` / `add_plugin` fail cleanly if the target already exists rather than silently overwriting.
4. **Partial updates.** `update_*` tools accept only the fields that need to change; omitted fields are left untouched.
5. **Validation is separate.** `validate` is a dedicated tool, not a side-effect of other operations, so callers control when checks happen.
