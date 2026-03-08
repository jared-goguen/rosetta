# Rosetta

**Rosetta is the MCP server framework and schema bundler for the OpenCode ecosystem.**

It provides three core components:

1. **MCP Server Library** (`lib/serve.ts`) - A generic, convention-based MCP server runtime
2. **Schema Bundler** (`src/`) - Scans artifacts and generates the discovery schema
3. **Commands Interface** (`commands/`) - Tools for creating and managing servers

## Overview

### The MCP Server Library

`lib/serve.ts` provides a convention-based MCP server runtime that:
- Auto-discovers tools from a `tools/` directory
- Handles stdio transport and MCP protocol
- Loads tool handlers, schemas, and metadata automatically
- Requires zero boilerplate to add new tools (just create a directory)

When you scaffold a new server with `/create-server`, it gets a copy of this library.

### The Schema Bundler

The bundler scans all artifacts in the ecosystem (tools, commands, plugins) and generates `rosetta.schema.json` - a single, unified schema file that agents load at startup for discovery.

Components:
- **scanner.ts** - Discovers and reads all artifact directories
- **bundle.ts** - Generates the schema with semantic type enrichment
- **validator.ts** - Validates artifact structure and schemas
- **types.json** - Semantic type registry for schema enrichment

### Commands

Two commands orchestrate the workflow:

- **`/create-server`** - Scaffold a new MCP server with Rosetta conventions
- **`/rebuild`** - Regenerate `rosetta.schema.json` when artifacts change

## Workflow

```
1. Create a new server
   /create-server my-server ~/projects
   
2. Implement tools in tools/ directory
   - Each tool gets its own directory with index.ts, schema.json, purpose.md
   
3. Rebuild the schema bundle
   /rebuild
   
4. Agents discover your tools via rosetta.schema.json
```

## MCP Server Conventions

Any server using Rosetta's library should follow these conventions:

```
my-server/
├── src/
│   ├── index.ts       # Entry point (stdio)
│   └── serve.ts       # Copy of lib/serve.ts from rosetta
├── tools/
│   ├── my_tool/
│   │   ├── index.ts       # Handler function
│   │   ├── schema.json    # Input/output JSON schema
│   │   └── purpose.md     # Tool description
│   └── ...
├── package.json
├── tsconfig.json
└── bun.lock
```

Tool discovery is automatic - just add a directory to `tools/` and implement the handler.

## Project Structure

```
rosetta/
├── lib/
│   └── serve.ts              # Generic MCP server runtime
├── src/
│   ├── bundle.ts             # Schema bundler
│   ├── scanner.ts            # Artifact discovery
│   ├── validator.ts          # Schema validation
│   ├── types.ts              # Type definitions
│   └── index.ts              # Rosetta server entry point
├── commands/
│   ├── create-server.md      # /create-server command definition
│   └── rebuild.md            # /rebuild command definition
├── types.json                # Semantic type registry
├── rosetta.schema.json       # Generated schema bundle (do not edit)
└── package.json
```

## Building the Rosetta Server

Rosetta itself runs as an MCP server that agents can call to scaffold new servers:

```bash
bun run src/index.ts
```

This exposes the `/create-server` and `/rebuild` commands via the MCP protocol.

## How Agents Use Rosetta

1. **Discovery** - Agents load `rosetta.schema.json` at startup
2. **Server Creation** - Agents call `/create-server` to scaffold MCP servers
3. **Schema Updates** - Agents call `/rebuild` when artifacts change
4. **Tool Composition** - Agents discover all available tools from the schema bundle
