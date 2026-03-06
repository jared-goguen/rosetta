# Rosetta

Rosetta is a schema registry and authoring server for agentic tooling.

Every agent in the ecosystem embeds the Rosetta schema at startup. This means an agent is born knowing the full capability surface of every other tool, command, and plugin — what exists, what it accepts, what it returns, and what it is for. No runtime discovery calls. No out-of-band documentation. Just a shared, typed vocabulary that every agent speaks from the moment it initializes.

Rosetta has two responsibilities:

1. **Maintain the schema.** As tools, commands, and plugins are added, changed, or removed, Rosetta keeps the canonical schema bundle accurate and current. This is the artifact agents embed at startup.

2. **Author the artifacts.** Rosetta provides an MCP interface for creating and managing the underlying tool, command, and plugin files — the convention-based file structure from which the schema is derived.

The name: just as the Rosetta Stone was the key that made otherwise opaque scripts legible across cultures, this server is the key that makes otherwise opaque agents legible to each other — not at runtime, but by construction.
