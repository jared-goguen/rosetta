Debug the schema pipeline when tools aren't showing up in rosetta.schema.json

Checks each stage of the schema generation pipeline:
- Verifies tool exists on disk with required files (index.ts, schema.json)
- Checks if schema includes the tool
- Provides diagnostic report showing which stage failed
- Suggests fixes based on what's missing

Returns human-readable report with checkmarks/X's showing pipeline status.
