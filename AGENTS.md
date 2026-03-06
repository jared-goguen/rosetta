# Rosetta — Agent Instructions

## Runtime
Use Bun throughout. Never use Node.js, ts-node, jest, or vitest.

- `bun run src/index.ts` — start the MCP server
- `bun test` — run all tests (unit + integration)
- `bun test tests/unit` — unit tests only (fast, no subprocess)
- `bun test tests/integration` — integration tests (spawns real server subprocess)

## Project Structure

```
src/
  index.ts        # entry point — stdio MCP server
  server.ts       # tool registration
  scanner.ts      # all filesystem reads
  bundle.ts       # rosetta.schema.json generation
  validator.ts    # artifact conformance checks
  types.ts        # shared interfaces
  tools/          # one file per tool group
tests/
  helpers/        # server subprocess harness, temp dirs, assertBundleConsistent
  fixtures/       # static artifact directories for unit tests
  unit/           # scanner, bundle, validator tests
  integration/    # full-stack tests through stdio transport
artifacts/        # convention root — tools/, commands/, plugins/
rosetta.schema.json  # generated bundle — do not edit by hand
```

## Key Conventions

- `ROSETTA_ROOT` env var controls where artifacts live and where `rosetta.schema.json` is written
- Every mutating tool handler calls `rebuildBundle()` after writing — disk and schema stay in sync
- `assertBundleConsistent(srv)` must be called at the end of every integration test
- `z.unknown()` is used for JSON Schema pass-through fields — `z.record(z.unknown())` breaks with Zod v4 + MCP SDK

## Adding a New Tool

1. Add the handler function to the appropriate file in `src/tools/`
2. Register it in `src/server.ts` with a Zod input schema
3. Add unit tests if the handler has non-trivial logic
4. Add integration tests in `tests/integration/` following the existing pattern
5. Run `bun test` — all 65 tests must pass before considering the work done
