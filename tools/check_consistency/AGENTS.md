Validate all MCPs follow conventions and best practices

Checks each server for:
- AGENTS.md documentation
- README.md documentation
- src/index.ts entry point
- tools/ directory structure
- Each tool has required files (index.ts, schema.json)
- Tool names match what's in schema

Returns consistency report showing ✅ (ok), ⚠️ (warning), ❌ (error) for each server
with detailed issues and suggestions for fixing.
