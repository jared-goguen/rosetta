---
description: Scaffold a new MCP server project following Rosetta conventions
---

Create a new MCP server following Rosetta conventions with all necessary boilerplate.

## Usage

```
/create-server <name> <directory> [tools] [remote]
```

### Arguments

- `name` (required): Project name in lowercase-hyphenated format (e.g., `my-server`)
- `directory` (required): Parent directory where the project will be created
- `tools` (optional): Comma-separated list of initial tool names to scaffold
- `remote` (optional): GitHub repository URL to set as git origin

## What Gets Created

The scaffolded server includes:
- Convention-based `tools/` directory for auto-discovered tools
- `src/index.ts` entry point with stdio MCP transport
- Complete test infrastructure with subprocess harness
- TypeScript configuration optimized for MCP development
- Bun package manager configuration
- Git repository initialization
- Comprehensive README template

## Git Remote Setup

If you provide a `remote` URL:
1. The git repository is initialized
2. The remote is configured as `origin`
3. An initial commit is created

To complete the setup after creating the server:
1. Create the repository on GitHub
2. Run: `cd <project-path> && git push -u origin main`

## Example

```
/create-server my-new-server ~/projects render_page,validate_schema git@github.com:user/my-new-server.git
```

This creates a new server at `~/projects/my-new-server` with two initial tools and git configured.
