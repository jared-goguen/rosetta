# Load-Bearing Semantic Types: Comprehensive Design

## Problem Statement

**Current state:** Semantic types in `types.json` are **documentation-only**. They describe intent but don't enforce contracts.

**Observed failures:**
1. `render_page` produced `<undefined></undefined>` HTML → deployed to production
2. `deploy_directory` deployed without `index.html` → 404 on live site
3. Test files mixed with production in `rendered/` → confusion about what's deployed
4. No validation of file existence, content, or structure

**Goal:** Make semantic types **load-bearing** - they actively prevent errors through runtime validation.

---

## Design Principles

### 1. **Types Should Fail Fast**
- Validate at MCP boundaries (input/output)
- Throw clear errors with actionable fixes
- Never silently accept invalid data

### 2. **Types Should Enforce Contracts**
- Between MCPs: gutenberg → pages-helper pipeline
- Within MCPs: file structure, content validity
- Across tools: consistent data shapes

### 3. **Types Should Be Composable**
- Base types (FilePath, DirectoryPath)
- Refinement types (HTMLFilePath extends FilePath + validates HTML)
- Contract types (DeployableDirectory extends DirectoryPath + requires index.html)

### 4. **Types Should Be Self-Documenting**
- Clear error messages reference type definitions
- Validation failures explain what's wrong AND how to fix it
- Examples show correct usage

---

## Type Categories

### Category 1: Base Types (Passive Validation)
**Current:** Pattern matching only (regex)
**Proposed:** No change - these are fine

Examples:
- `ProjectName`: `^[a-z][a-z0-9-]*$`
- `PortNumber`: `1-65535`
- `ToolName`: `^[a-z][a-z0-9_]*$`

### Category 2: File Path Types (Active Validation)
**Current:** Pattern matching only
**Proposed:** Runtime validation of existence, permissions, content

Examples:
- `GutenbergSpecPath` → validates `.yaml` extension + file exists + valid YAML
- `HTMLFilePath` → validates `.html` extension + file exists + valid HTML + size > 100 bytes
- `ImageFilePath` → validates image extension + file exists + valid image format

**Validation levels:**
1. **Structural** (pattern, extension) - cheap, always run
2. **Existence** (file exists, readable) - medium cost, run on input
3. **Content** (valid format, size constraints) - expensive, run selectively

### Category 3: Directory Types (Contract Validation)
**Current:** Basic path validation
**Proposed:** Validate directory contents meet requirements

Examples:
- `DirectoryPath` → validates path exists + is directory
- `DeployableDirectory` → extends DirectoryPath + MUST contain `index.html` + all files valid HTML
- `GutenbergSpecDirectory` → extends DirectoryPath + all files end in `.yaml`

**Contract enforcement:**
```typescript
type DeployableDirectory = DirectoryPath & {
  invariants: [
    "MUST contain index.html at root",
    "MUST NOT contain files < 100 bytes",
    "MUST NOT contain test files (e.g., *-test.html, *-final.html)"
  ]
}
```

### Category 4: Pipeline Types (Cross-MCP Contracts)
**Current:** Documented in `pipeline_position` but not enforced
**Proposed:** Validate data flows through pipeline correctly

Pipeline: `GutenbergSpecPath → HTMLFilePath → ImageFilePath → CloudflareURL`

**Validation:**
- Output of step N must match input of step N+1
- Each step produces exactly what next step expects
- Type transformations are explicit and validated

---

## Implementation Strategy

### Phase 1: Type Definition Enhancement

**Add to `types.json`:**
```json
{
  "HTMLFilePath": {
    "base": "string",
    "validation": {
      "pattern": "^.*\\.html$",
      "runtime": {
        "fileExists": true,
        "minSize": 100,
        "contentValidation": "isValidHTML",
        "forbiddenPatterns": ["<undefined>", "<null>"]
      }
    },
    "errorMessages": {
      "fileMissing": "HTML file not found at {path}. Did you run gutenberg_render_page first?",
      "tooSmall": "HTML file is only {size} bytes. Expected at least 100. This indicates a rendering failure.",
      "invalidContent": "File contains {pattern}. Check your component implementations for undefined returns."
    }
  }
}
```

### Phase 2: Validator Functions

**Create `rosetta/src/validators/`:**
```typescript
// rosetta/src/validators/index.ts
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  type: string;
  message: string;
  fix?: string;  // Actionable guidance
}

export async function validateType(
  value: unknown,
  typeName: string,
  context?: Record<string, unknown>
): Promise<ValidationResult>
```

**Validator implementations:**
```typescript
// rosetta/src/validators/html-file-path.ts
export async function validateHTMLFilePath(path: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  
  // 1. Structural validation (cheap)
  if (!path.endsWith('.html')) {
    errors.push({
      type: "INVALID_EXTENSION",
      message: `Path must end with .html, got: ${path}`,
      fix: "Use gutenberg_render_page to generate HTML files"
    });
  }
  
  // 2. Existence validation (medium cost)
  if (!await fileExists(path)) {
    errors.push({
      type: "FILE_NOT_FOUND",
      message: `HTML file not found: ${path}`,
      fix: "Run gutenberg_render_page first to generate the HTML"
    });
    return { valid: false, errors, warnings: [] };
  }
  
  // 3. Content validation (expensive)
  const content = await readFile(path, 'utf-8');
  
  if (content.length < 100) {
    errors.push({
      type: "FILE_TOO_SMALL",
      message: `HTML file is only ${content.length} bytes (expected at least 100)`,
      fix: "This indicates a rendering failure. Check component implementations for undefined returns."
    });
  }
  
  if (content.includes('<undefined>')) {
    errors.push({
      type: "INVALID_CONTENT",
      message: "HTML contains '<undefined>' - component returned undefined",
      fix: "Check your component render functions in gutenberg/src/components/"
    });
  }
  
  return { valid: errors.length === 0, errors, warnings: [] };
}
```

### Phase 3: MCP Integration

**Wrap tool handlers with validation:**
```typescript
// rosetta/src/validators/mcp-wrapper.ts
export function withTypeValidation(
  handler: ToolHandler,
  schema: ToolSchema
): ToolHandler {
  return async (input: Record<string, unknown>) => {
    // 1. Validate inputs
    for (const [key, value] of Object.entries(input)) {
      const paramSchema = schema.input.properties[key];
      if (paramSchema['x-semantic-type']) {
        const result = await validateType(value, paramSchema['x-semantic-type']);
        if (!result.valid) {
          throw new ValidationError(
            `Invalid ${key}: ${result.errors.map(e => e.message).join('; ')}`,
            result.errors
          );
        }
      }
    }
    
    // 2. Execute handler
    const output = await handler(input);
    
    // 3. Validate outputs
    // ... similar validation for outputs
    
    return output;
  };
}
```

**Auto-apply to all tools:**
```typescript
// mcp-core/src/serve.ts
const handler = await import(handlerPath);
const schema = await readSchema(schemaPath);

// Wrap with type validation
const validatedHandler = withTypeValidation(handler.handler, schema);

tools.push({
  name: toolName,
  handler: validatedHandler,  // Use validated version
  schema: schema.input
});
```

### Phase 4: Contract Types

**Add contract validation for directories:**
```typescript
// rosetta/src/validators/deployable-directory.ts
export async function validateDeployableDirectory(path: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  
  // 1. Must be a directory
  if (!await isDirectory(path)) {
    errors.push({
      type: "NOT_A_DIRECTORY",
      message: `Path is not a directory: ${path}`,
      fix: "Provide a directory path, not a file path"
    });
    return { valid: false, errors, warnings: [] };
  }
  
  // 2. Must contain index.html
  const indexPath = join(path, 'index.html');
  if (!await fileExists(indexPath)) {
    errors.push({
      type: "MISSING_INDEX_HTML",
      message: `Directory must contain index.html at root: ${path}`,
      fix: "Create index.html or copy your main page to index.html before deploying"
    });
  }
  
  // 3. Check for test files (warning, not error)
  const files = await readdir(path);
  const testFiles = files.filter(f => 
    f.includes('-test.html') || 
    f.includes('-final.html') ||
    f.includes('-new.html')
  );
  
  const warnings = testFiles.length > 0 
    ? [`Found test files that should not be deployed: ${testFiles.join(', ')}`]
    : [];
  
  // 4. Validate all HTML files
  for (const file of files.filter(f => f.endsWith('.html'))) {
    const filePath = join(path, file);
    const result = await validateHTMLFilePath(filePath);
    errors.push(...result.errors);
  }
  
  return { valid: errors.length === 0, errors, warnings };
}
```

**Add to types.json:**
```json
{
  "DeployableDirectory": {
    "description": "Directory ready for Cloudflare Pages deployment",
    "base": "DirectoryPath",
    "validation": {
      "runtime": {
        "validator": "validateDeployableDirectory",
        "required": [
          "index.html must exist at root",
          "all HTML files must be valid (>100 bytes, no undefined)",
          "directory must be readable"
        ],
        "warnings": [
          "test files should be in rendered-test/ not rendered/"
        ]
      }
    },
    "errorMessages": {
      "missingIndex": "Missing index.html. Cloudflare Pages serves this at the root URL. Create it first.",
      "invalidFiles": "Directory contains invalid HTML files. Run validation before deploying."
    }
  }
}
```

---

## Tool Schema Updates

### Before (passive documentation):
```json
{
  "name": "deploy_directory",
  "input": {
    "type": "object",
    "properties": {
      "directory": {
        "type": "string",
        "x-semantic-type": "DirectoryPath"
      }
    }
  }
}
```

### After (active validation):
```json
{
  "name": "deploy_directory",
  "input": {
    "type": "object",
    "properties": {
      "directory": {
        "type": "string",
        "x-semantic-type": "DeployableDirectory",
        "x-validate-at": "call-time",
        "x-validation-level": "strict"
      }
    }
  }
}
```

---

## Error Message Quality

### Bad (current):
```
Error: Internal error
```

### Good (proposed):
```
ValidationError: Invalid directory parameter for deploy_directory

Type: DeployableDirectory
Path: /home/jared/source/pages/rendered
Issues:
  1. MISSING_INDEX_HTML: Directory must contain index.html at root
     → Fix: Create index.html or copy your main page to index.html
  
  2. INVALID_CONTENT: File contains '<undefined>' at rendered/exercise-spec-final.html
     → Fix: Check your component render functions in gutenberg/src/components/

Warnings:
  - Found test files that should not be deployed: exercise-spec-new.html, exercise-spec-final.html
  - Consider using rendered-test/ for test outputs

Next steps:
  1. Ensure index.html exists: cp rendered/landing.html rendered/index.html
  2. Move test files: mv rendered/*-test.html rendered-test/
  3. Re-run deploy_directory
```

---

## Migration Path

### Phase 1: Documentation (✅ DONE)
- types.json describes types
- Tools document expected types in schemas

### Phase 2: Optional Validation (Week 1)
- Add validators to rosetta
- Tools can opt-in with `x-validate-at: "call-time"`
- Errors are warnings initially

### Phase 3: Enforced Validation (Week 2)
- Enable validation by default
- Tools that violate contracts throw errors
- Update tool implementations to satisfy contracts

### Phase 4: Pipeline Validation (Week 3)
- Validate cross-MCP data flows
- Ensure gutenberg → pages-helper pipeline integrity
- Auto-detect type mismatches

---

## Success Metrics

### Prevented Errors
- ✅ No more `<undefined>` deployed to production
- ✅ No more 404s from missing index.html
- ✅ No more test files in production deployments
- ✅ Clear error messages guide users to fixes

### Developer Experience
- ✅ Type violations caught at MCP boundary (fail fast)
- ✅ Error messages are actionable (not just "invalid input")
- ✅ Types document contracts (self-documenting)
- ✅ Pipeline integrity guaranteed (no silent failures)

---

## Open Questions for Next Session

1. **Validation performance:** When to validate? Always? Cache results?
2. **Validation strictness:** Strict (throw) vs lenient (warn)?
3. **Backward compatibility:** How to migrate existing tools?
4. **Type composition:** How do refinement types work? TypeScript-style?
5. **Cross-MCP validation:** How to validate pipeline without coupling?
6. **Custom validators:** Can tools define their own validators?
7. **Validation reporting:** Where do validation errors go? Logs? Return values?

---

## Next Steps

1. **Review this design** - is the approach sound?
2. **Choose validation strategy** - strict vs lenient, when to validate
3. **Implement base validators** - FilePath, DirectoryPath, HTMLFilePath
4. **Update one tool** - start with deploy_directory as proof of concept
5. **Test and iterate** - validate against real usage patterns
