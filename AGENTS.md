# Rosetta — Agent Instructions

## Runtime
Use Bun throughout. Never use Node.js, ts-node, jest, or vitest.

- `bun run src/index.ts` — start the MCP server
- `bun test` — run all tests (unit + integration)
- `bun test tests/unit` — unit tests only (fast, no subprocess)
- `bun test tests/integration` — integration tests (spawns real server subprocess)

## Project Structure

```
lib/
  serve.ts        # convention server runtime — auto-discovers tools
src/
  index.ts        # entry point — stdio MCP server
  scanner.ts      # all filesystem reads (tools, commands, plugins, servers)
  bundle.ts       # rosetta.schema.json generation
  validator.ts    # artifact conformance checks
  types.ts        # shared interfaces
tests/
  helpers/        # server subprocess harness, temp dirs, assertBundleConsistent
  fixtures/       # static artifact directories for unit tests
  unit/           # scanner, bundle, validator, serve tests
  integration/    # full-stack tests through stdio transport
tools/            # convention root — tool implementations
commands/         # slash-command definitions (optional)
plugins/          # plugin modules (optional)
servers/          # MCP server registry (YAML files)
flows/            # Flowbot-compatible workflow definitions
  new_server.yaml # 9-state flow for building any MCP server
rosetta.schema.json  # generated bundle — do not edit by hand
```

## Key Conventions

- `ROSETTA_ROOT` env var controls where artifacts live and where `rosetta.schema.json` is written
- Every mutating tool handler calls `rebuildBundle()` after writing — disk and schema stay in sync
- `assertBundleConsistent(srv)` must be called at the end of every integration test
- Tools are **auto-discovered** from `tools/` directories — no manual registration needed
- Tool schemas in `schema.json` are passed directly to `tools/list` — no Zod conversion
- Tool names come from **directory names**, not function names
- All Rosetta MCP tools are prefixed: `rosetta_add_tool`, `rosetta_get_tool`, etc.

## Adding a New Tool

1. Create `tools/<tool_name>/` directory
2. Add `tools/<tool_name>/index.ts` with an exported async function
3. Add `tools/<tool_name>/schema.json` with `input` and `output` schemas
4. Add `tools/<tool_name>/purpose.md` with a description (first line is summary)
5. Add tests if the handler has non-trivial logic
6. Run `bun test` — all tests must pass

**Tools are automatically discovered and registered. No server code changes needed.**

## Registering an External MCP Server

1. Create `servers/<server_name>.yaml` with metadata:
   ```yaml
   name: server-name
   type: local | remote
   location: /path/to/server  # for local
   url: https://...           # for remote
   description: What the server does
   tools:
     - tool1
     - tool2
   enabled: true
   ```
2. Server metadata is automatically included in schema bundle
3. Agents can discover servers via `rosetta_list_servers` and `rosetta_get_server`
4. Cross-server tools use naming convention: `<server>_<tool>` (e.g., `gutenberg_render_page`)

**Currently registered servers:** rosetta, gutenberg, flowbot, cf-pages, cloudflare, github

## Flow-Driven Development

New servers should be built using the `new_server.yaml` flow for structured, permission-enforced development.

### Activation

```
1. flowbot_start_flow { path: "/home/jared/source/rosetta/flows/new_server.yaml" }
2. write instancePath to /home/jared/source/.opencode/flowguard.active
3. FlowGuard plugin enforces permissions for each state automatically
```

### State Permissions Summary

| State | What you can do |
|---|---|
| `gathering` | Read Rosetta schemas only — no code changes |
| `researching` | Read + filesystem + bash for exploration |
| `scaffolding` | `rosetta_create_server` + read + filesystem |
| `implementing_shared` | Rosetta read/write + filesystem + bash |
| `implementing_tools` | Rosetta read/write + filesystem (no bash) |
| `validating_unit` | Read + filesystem + bash (`bun test tests/unit`) |
| `validating_integration` | Read + filesystem + bash (`bun test tests/integration`) |
| `debugging` | Rosetta read/write + filesystem + bash |
| `configuring` | Filesystem + bash (register in opencode.json) |
| `complete` | Nothing — read-only terminal state |

Each state also has a `subagent.prompt` with detailed instructions for what to do and what to confirm before transitioning.
