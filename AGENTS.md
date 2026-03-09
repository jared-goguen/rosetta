# Rosetta — Agent Instructions

## Understanding Rosetta

Rosetta has three components:

1. **MCP Server Library** (`lib/serve.ts`)
   - Provides convention-based tool discovery and stdio transport
   - Used by all scaffolded MCP servers
   - You don't interact with this directly

2. **Schema Bundler** (`src/`)
   - Generates `rosetta.schema.json` from all artifacts in the codebase
   - Scans tools, commands, plugins from the filesystem
   - Enriches schemas with semantic type metadata
   - Called via the `/rebuild` command

3. **Commands Interface** (`commands/`)
   - `/create-server` - Scaffold new MCP servers
   - `/rebuild` - Regenerate the schema bundle

## For Agents: Discovery and Composition

When you start, you load `rosetta.schema.json` to discover:
- All tools available in all servers
- All commands available
- All plugins loaded
- Semantic type information

The schema is the ground truth for what's discoverable.

## Workflow: Creating a New MCP Server

When tasked with creating a new MCP server:

1. **Call `/create-server`**
   ```
   /create-server <name> <directory> [tools] [remote]
   ```
   - `name`: Project name (lowercase-hyphenated, e.g., `my-server`)
   - `directory`: Parent directory for the project
   - `tools` (optional): Comma-separated list of initial tool names
   - `remote` (optional): GitHub repository URL

2. **Implement the tools**
   - Each tool goes in `tools/<tool_name>/`
   - Create `index.ts` with your handler function
   - Create `schema.json` with input/output schemas
   - Create `purpose.md` with a description

3. **Call `/rebuild`**
   - Regenerates `rosetta.schema.json`
   - Agents immediately discover your new tools

## MCP Server Conventions

All Rosetta servers follow these conventions:

### Directory Structure
```
my-server/
├── src/
│   ├── index.ts              # Entry point
│   └── serve.ts              # From lib/serve.ts
├── tools/
│   ├── tool_name/
│   │   ├── index.ts          # Handler: export async function handler(input)
│   │   ├── schema.json       # { input: {...}, output: {...} }
│   │   └── purpose.md        # Human-readable description
│   └── ...
├── package.json
├── tsconfig.json
└── bun.lock
```

### Tool Handler Signature
```typescript
export async function handler(input: Record<string, unknown>): Promise<MCP_RESPONSE>
```

Where `MCP_RESPONSE` is:
```typescript
{
  content: Array<{ type: string; text: string }>
}
```

### Schema Format
```json
{
  "input": {
    "type": "object",
    "properties": {
      "param_name": {
        "type": "string",
        "description": "What this parameter does"
      }
    },
    "required": ["param_name"]
  },
  "output": {
    "type": "object",
    "properties": {
      "result": { "type": "string" }
    }
  }
}
```

## Development Cycle

1. **Create server** → `/create-server my-server ~/projects`
2. **Add/modify tools** → Create `tools/<name>/` directories
3. **Test locally** → `bun run src/index.ts` in the server directory
4. **Rebuild schema** → `/rebuild` (from rosetta directory)
5. **Verify** → Check `rosetta.schema.json` includes your tools

## Runtime Behavior

### Tool Discovery
When an MCP server starts, `lib/serve.ts`:
1. Scans the `tools/` directory
2. Loads each tool's `index.ts` handler
3. Loads each tool's `schema.json` for validation
4. Loads each tool's `purpose.md` for metadata

### Schema Generation
When you call `/rebuild`, the bundler:
1. Scans `src/tools/` directories across all servers
2. Extracts tool definitions
3. Validates all schemas are valid JSON Schema
4. Enriches with semantic type info from `types.json`
5. Writes `rosetta.schema.json`

## Key Principles

- **Convention over Configuration** - Tool names come from directory names, not code
- **Automatic Discovery** - No manual registration needed
- **Zero Boilerplate** - Add a tool directory, implement the handler, you're done
- **Type Safety** - All tools have validated JSON schemas
- **Semantic Enrichment** - Schemas can include domain-specific type annotations

## Common Tasks

### Create a new tool in an existing server
```
1. Create tools/<tool_name>/ directory in the server
2. Implement tools/<tool_name>/index.ts with handler function
3. Write tools/<tool_name>/schema.json with input/output schemas
4. Write tools/<tool_name>/purpose.md with description
5. Call /rebuild from rosetta directory
```

### Create a brand new MCP server
```
1. Call /create-server my-server ~/projects [tool1,tool2]
2. Implement tools/ in the new server
3. Call /rebuild from rosetta directory
4. Push to GitHub if you provided --remote
```

### Test a server locally
```
cd path/to/server
bun run src/index.ts
```
This starts the MCP server on stdio. Use client libraries to test.

## MCP Dependencies Convention

Some tools use external MCPs (like Cloudflare) that Rosetta can't directly integrate.

### Declaration

Tools that depend on external MCPs should declare this in `schema.json`:

```json
{
  "input": { ... },
  "output": { ... },
  "mcp_dependencies": {
    "cloudflare": {
      "required": true,
      "description": "Cloudflare Pages API",
      "operations": [
        "POST /accounts/{account_id}/pages/projects/{project_name}/deployments"
      ],
      "environment": {
        "CLOUDFLARE_ACCOUNT_ID": "Your account ID",
        "CLOUDFLARE_API_TOKEN": "API token with Pages write"
      },
      "documentation": "https://..."
    }
  }
}
```

### Documentation

Tools with external dependencies should add an "MCP Dependencies" section to `AGENTS.md`:

```markdown
## MCP Dependencies

**Requires:** Cloudflare MCP

This tool uses the Cloudflare Pages Direct Upload API.

### Configuration
- Set `CLOUDFLARE_ACCOUNT_ID` environment variable
- Set `CLOUDFLARE_API_TOKEN` environment variable

### Operations Used
- `POST /accounts/{account_id}/pages/projects/{project_name}/deployments`

### Failure Modes
- If Cloudflare MCP not available: "Cloudflare MCP not found"
- If credentials missing: "CLOUDFLARE_API_TOKEN not set"
```

### Code Documentation

Add JSDoc `@requires` annotations to handlers:

```typescript
/**
 * Deploy to Cloudflare Pages.
 * 
 * @requires cloudflare MCP
 * @requires CLOUDFLARE_ACCOUNT_ID environment variable
 * @requires CLOUDFLARE_API_TOKEN environment variable
 */
export async function handler(input: Record<string, unknown>) {
  // ...
}
```

### Agent Discovery

Agents can check for MCP dependencies before using a tool:

```python
def can_use_tool(tool_name, available_mcps):
    schema = rosetta_schema["tools"][tool_name]
    deps = schema.get("mcp_dependencies", {})
    
    for mcp_name, dep in deps.items():
        if dep["required"] and mcp_name not in available_mcps:
            return False  # Tool requires MCP that's not available
    
    return True
```

### Benefits

- **Machine-readable** - Agents can parse dependencies
- **Explicit** - No guessing about external requirements
- **Helpful errors** - Tools can provide clear error messages
- **Future-proof** - Works for any remote MCP
- **Documented** - Three levels of documentation

## Troubleshooting

**Schema doesn't include my tool?**
- Ensure your tool directory is in `tools/` (not `src/tools`)
- Ensure `index.ts` exports a handler function
- Ensure `schema.json` exists and is valid JSON
- Run `/rebuild` again

**Handler throwing errors?**
- Check the tool is properly exported: `export async function handler(...)`
- Verify the handler returns `{ content: Array<...> }`
- Test locally with `bun run src/index.ts`

**Semantic types not showing up?**
- Check `types.json` has your type definitions
- Run `/rebuild` to regenerate with enriched schemas
