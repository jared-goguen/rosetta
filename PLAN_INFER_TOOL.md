# Implementation Plan: rosetta_infer Tool

## Context

Rosetta now has semantic inference: tools annotate with `$domain` and `$operation`, and tags are inferred from a lookup table at bundle time.

**Current state:**
- `rosetta/infer.json` — lookup table mapping `domain:operation` → tags
- `rosetta/src/scanner.ts` — `inferTags()` function used during bundling
- Inference only happens at build time, not queryable at runtime

**Problem:** Agents can't ask "what tags would this annotation produce?" or "why does this tool have these tags?"

## Goal

Create `rosetta_infer` tool that exposes inference logic at runtime.

## Specification

### Input
```json
{
  "domain": "filesystem",
  "operation": "writes-to"
}
```

### Output
```json
{
  "key": "filesystem:writes-to",
  "inferredTags": ["write"],
  "valid": true
}
```

### Error case (invalid domain/operation)
```json
{
  "key": "invalid:unknown",
  "inferredTags": [],
  "valid": false,
  "error": "No inference rule found for 'invalid:unknown'"
}
```

## Implementation Steps

### 1. Create tool directory structure

```
rosetta/tools/infer/
├── index.ts
├── schema.json
└── purpose.md
```

### 2. Implement handler (`index.ts`)

```typescript
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface InferenceTable {
  domains: string[];
  operations: string[];
  inference: Record<string, string[]>;
}

let tableCache: InferenceTable | null = null;

async function loadTable(): Promise<InferenceTable> {
  if (tableCache) return tableCache;
  
  const inferPath = join(__dirname, "../../infer.json");
  const content = await readFile(inferPath, "utf8");
  tableCache = JSON.parse(content);
  return tableCache!;
}

export async function infer(input: { domain: string; operation: string }) {
  const table = await loadTable();
  const key = `${input.domain}:${input.operation}`;
  const inferredTags = table.inference[key];
  
  const validDomain = table.domains.includes(input.domain);
  const validOperation = table.operations.includes(input.operation);
  
  const result: any = {
    key,
    inferredTags: inferredTags ?? [],
    valid: !!inferredTags,
  };
  
  if (!inferredTags) {
    if (!validDomain) {
      result.error = `Unknown domain '${input.domain}'. Valid: ${table.domains.join(", ")}`;
    } else if (!validOperation) {
      result.error = `Unknown operation '${input.operation}'. Valid: ${table.operations.join(", ")}`;
    } else {
      result.error = `No inference rule for '${key}'`;
    }
  }
  
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(result, null, 2),
    }],
  };
}
```

### 3. Create schema (`schema.json`)

```json
{
  "$domain": "meta",
  "$operation": "reads-from",
  "input": {
    "type": "object",
    "properties": {
      "domain": {
        "type": "string",
        "description": "Semantic domain (filesystem, network, database, process, config, meta)"
      },
      "operation": {
        "type": "string",
        "description": "Operation type (reads-from, writes-to, executes, queries)"
      }
    },
    "required": ["domain", "operation"],
    "additionalProperties": false
  },
  "output": {
    "type": "object",
    "properties": {
      "key": { "type": "string" },
      "inferredTags": { 
        "type": "array", 
        "items": { "type": "string" } 
      },
      "valid": { "type": "boolean" },
      "error": { "type": "string" }
    }
  }
}
```

### 4. Create purpose file (`purpose.md`)

```markdown
Query the semantic inference table to see what tags a domain:operation combination produces.

Use this to understand how tool annotations map to permission tags, or to validate annotations before adding them to a schema.
```

### 5. Rebuild schema

```bash
cd /home/jared/source && bun run rebuild.ts
```

## Verification

```bash
# Test the tool directly
cd /home/jared/source/rosetta
bun run src/index.ts

# In another terminal, call via MCP client or test:
# rosetta_infer { domain: "filesystem", operation: "reads-from" }
# Expected: { inferredTags: ["default-allowed", "read-only"], valid: true }

# rosetta_infer { domain: "filesystem", operation: "writes-to" }  
# Expected: { inferredTags: ["write"], valid: true }

# rosetta_infer { domain: "invalid", operation: "unknown" }
# Expected: { inferredTags: [], valid: false, error: "..." }
```

## Files Changed

- `rosetta/tools/infer/index.ts` — NEW
- `rosetta/tools/infer/schema.json` — NEW  
- `rosetta/tools/infer/purpose.md` — NEW

## Estimated Effort

~30 minutes
