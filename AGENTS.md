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

**Currently registered servers:** rosetta, gutenberg, flowbot, pages, cloudflare, github

## Flow-Driven Development

New servers should be built using the `new_server.yaml` flow for structured, guided development.

### How to Use the Flow

The `new_server.yaml` flow provides a step-by-step workflow for building MCP servers. It is **advisory** — there is no enforcement, only guidance.

**Usage:**
1. Call `flowbot_start_flow { path: "/home/jared/source/rosetta/flows/new_server.yaml" }`
2. This returns an `instancePath` — save this for later
3. Call `flowbot_get_state { instancePath }` to see the current state, guidance, and recommended tools
4. Follow the guidance in the `guidance` field
5. When ready to move to the next state, call `flowbot_transition { instancePath, toState: "next-state-name" }`

### Advisory Tool Lists per State

Each state recommends a set of tools. These are suggestions, not restrictions:

| State | Recommended tools |
|---|---|
| `gathering` | `rosetta_get_schema`, `rosetta_list_tools`, `read`, `question` |
| `researching` | `read`, `bash`, `webfetch`, `glob`, `grep` |
| `scaffolding` | `rosetta_create_server`, `read`, `write`, `glob` |
| `implementing_shared` | `rosetta_read/write tools`, `read`, `write`, `edit`, `bash` |
| `implementing_tools` | `rosetta_read/write tools`, `read`, `write`, `edit` |
| `validating_unit` | `read`, `bash` (`bun test tests/unit`) |
| `validating_integration` | `read`, `bash` (`bun test tests/integration`) |
| `debugging` | `rosetta_read/write tools`, `read`, `write`, `edit`, `bash` |
| `configuring` | `read`, `write`, `edit`, `bash` |
| `complete` | Terminal state — read-only |

Each state also has a detailed `guidance` field with instructions for what to do and what to confirm before transitioning.
