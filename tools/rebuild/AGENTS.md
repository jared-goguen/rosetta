Rebuild schema with change detection and feedback

Rebuilds rosetta.schema.json with:
- Automatic change detection (what was added/removed/modified)
- Tool count tracking
- Clear feedback on what changed
- Shows when rebuild is needed
- Integrated with scanner and bundler

Returns rebuild report showing:
- Number of tools found
- What was added/removed/modified
- Final tool count
- Status (success or error)
