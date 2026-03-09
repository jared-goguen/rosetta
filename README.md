# Rosetta

The schema framework for LLM-native MCP tools.

## Design Philosophy

**Tools should be designed for LLM consumption, not programmatic precision.**

The LLM is the semantic layer. Tools provide structured context that agents 
can reason over — not query interfaces requiring precise syntax.

| Traditional API Design        | LLM-Native Tool Design           |
|-------------------------------|----------------------------------|
| Precise inputs (regex, SQL)   | Natural language descriptions    |
| Raw data output               | Structured context for reasoning |
| Tool does the matching        | LLM does the matching            |
| Designed for programs         | Designed for agents              |

Every tool accepts **intent** and returns **context**. The agent bridges the gap.

---

## Convention-Based Building

No registration. No boilerplate. Directory structure is the API.

```
server/
└── tools/
    └── find/
        ├── index.ts      # Handler function
        ├── schema.json   # Input/output schema
        └── AGENTS.md     # What this tool does (for LLMs)
```

Create the directory. Run `/rebuild`. Tool is discoverable.

### Why This is LLM-Native

**WRITE > EDIT for agents.**

Creating a tool = write 3 files in a new directory. No edits to existing code.
No registration. No imports. No insertion points to find.

Agents create tools through pure file creation — atomic, predictable, safe.

`AGENTS.md` — context for agents, not documentation for humans.

---

## Semantic Types

Types that carry meaning for LLMs, not just compilers.

```typescript
// types.ts

/** A natural language description of what the agent is looking for */
export type Intent = string;

/** A file path with semantic context about what it contains */
export type AnnotatedPath = {
  path: string;
  summary: string;      // What this file does
  relevance: number;    // How well it matches the intent
};

/** Filesystem context optimized for LLM reasoning */
export type FileContext = {
  matches: AnnotatedPath[];
  scope: string;        // What was searched
  suggestions: string[]; // Refinement hints
};
```

Schemas reference these types. Agents understand what they're working with.

---

## The Ecosystem

- **fs**: Describe what you're looking for → get digestible file context
- **gutenberg**: Describe the page you want → get rendered HTML  
- **flowbot**: Describe workflow state → get guidance on transitions
- **grounder**: Describe what to measure → get analytics

---

## Usage

```bash
/rebuild          # Bundle all tool schemas
/create-server    # Scaffold a new MCP server
```

All schemas bundle into `rosetta.schema.json` — single source of truth.
