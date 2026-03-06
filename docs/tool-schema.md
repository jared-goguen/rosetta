# MCP Builder - Tool Schema Design

## Core Concept
This MCP server manages tools, commands, and plugins as files in convention-based directories. Each type has its own directory:
- `/tools/` - Executable tools
- `/commands/` - One-shot command definitions
- `/plugins/` - Extendable plugin modules

---

## Tools

### `list_tools`
List all available tools in `/tools/`.
- **Input**: `{ directory?: string }` - optional subdirectory
- **Output**: `[{ name: string, path: string, description?: string }]`

### `get_tool`
Read a tool's definition file.
- **Input**: `{ name: string }`
- **Output**: `{ name: string, path: string, content: string, metadata: ToolMetadata }`

### `create_tool`
Create a new tool file from template or raw content.
- **Input**: `{ name: string, content: string, description?: string }`
- **Output**: `{ success: boolean, path: string }`

### `update_tool`
Modify an existing tool.
- **Input**: `{ name: string, content: string }`
- **Output**: `{ success: boolean }`

### `delete_tool`
Remove a tool file.
- **Input**: `{ name: string }`
- **Output**: `{ success: boolean }`

---

## Commands

### `list_commands`
List all available commands in `/commands/`.
- **Input**: `{ directory?: string }`
- **Output**: `[{ name: string, path: string, description?: string }]`

### `get_command`
Read a command's definition.
- **Input**: `{ name: string }`
- **Output**: `{ name: string, path: string, content: string, metadata: CommandMetadata }`

### `create_command`
Create a new command file.
- **Input**: `{ name: string, content: string, description?: string }`
- **Output**: `{ success: boolean, path: string }`

### `update_command`
Modify an existing command.
- **Input**: `{ name: string, content: string }`
- **Output**: `{ success: boolean }`

### `delete_command`
Remove a command file.
- **Input**: `{ name: string }`
- **Output**: `{ success: boolean }`

### `execute_command`
Run a command directly.
- **Input**: `{ name: string, args?: Record<string, any> }`
- **Output**: `{ result: any }`

---

## Plugins

### `list_plugins`
List all available plugins in `/plugins/`.
- **Input**: `{ directory?: string }`
- **Output**: `[{ name: string, path: string, version?: string, description?: string }]`

### `get_plugin`
Read a plugin's manifest/definition.
- **Input**: `{ name: string }`
- **Output**: `{ name: string, path: string, manifest: PluginManifest, files: string[] }`

### `create_plugin`
Create a new plugin directory with manifest.
- **Input**: `{ name: string, manifest: PluginManifest, files?: Record<string, string> }`
- **Output**: `{ success: boolean, path: string }`

### `update_plugin`
Modify a plugin (update manifest or files).
- **Input**: `{ name: string, manifest?: PluginManifest, files?: Record<string, string> }`
- **Output**: `{ success: boolean }`

### `delete_plugin`
Remove a plugin directory.
- **Input**: `{ name: string }`
- **Output**: `{ success: boolean }`

### `enable_plugin`
Enable a plugin (register it).
- **Input**: `{ name: string }`
- **Output**: `{ success: boolean }`

### `disable_plugin`
Disable a plugin (unregister it).
- **Input**: `{ name: string }`
- **Output**: `{ success: boolean }`

---

## Utility Tools

### `discover`
Scan all directories and return complete inventory.
- **Input**: `{}`
- **Output**: `{ tools: ToolSummary[], commands: CommandSummary[], plugins: PluginSummary[] }`

### `validate`
Validate tool/command/plugin structure.
- **Input**: `{ type: "tool" | "command" | "plugin", name: string }`
- **Output**: `{ valid: boolean, errors: string[] }`

### `export`
Export a tool/command/plugin as a shareable package.
- **Input**: `{ type: string, name: string }`
- **Output**: `{ path: string, size: number }`

### `import`
Import a tool/command/plugin from a package.
- **Input**: `{ path: string }`
- **Output**: `{ success: boolean, name: string }`

---

## Conventions

### Tool File Format
```
/tools/
  hello/
    index.ts       # main implementation
    purpose.md     # optional description
    schema.json    # optional input schema
```

### Command File Format
```
/commands/
  deploy/
    index.js       # command implementation
    purpose.md     # command description
```

### Plugin File Format
```
/plugins/
  my-plugin/
    manifest.json  # name, version, dependencies
    index.ts       # entry point
    /src/          # plugin source
```

---

## Metadata Schemas

```typescript
interface ToolMetadata {
  name: string;
  description?: string;
  version?: string;
  schema?: object;
}

interface CommandMetadata {
  name: string;
  description?: string;
  arguments?: object;
}

interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  entry: string;
}
```
