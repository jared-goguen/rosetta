---
description: Generate the rosetta.schema.json bundle with all tools, commands, plugins, and servers
---

Rebuild the complete Rosetta schema bundle by scanning the filesystem and regenerating `rosetta.schema.json`.

## Usage

```
/rebuild
```

This command scans all registered artifacts (tools, commands, plugins, and servers) and regenerates the complete schema bundle that agents use for discovery and composition.

## What It Does

1. Scans `tools/`, `commands/`, `plugins/`, and `servers/` directories
2. Validates all artifact structures
3. Extracts metadata from manifest files
4. Regenerates `rosetta.schema.json` with complete schema information
5. Updates the bundle timestamp

The generated bundle includes:
- All tool definitions with input/output schemas
- All command definitions with argument schemas
- All plugin metadata with versions and dependencies
- All registered MCP servers with their tools

## When to Run

Run this after:
- Adding new tools, commands, or plugins
- Modifying artifact schemas
- Registering new servers
- Making any changes to artifact definitions

## Example

```
/rebuild
```

This regenerates the schema bundle to ensure all artifacts are discoverable by agents.
