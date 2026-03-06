import { join } from "path";
import { readFile, stat } from "fs/promises";
import Ajv from "ajv";
import { getRoot } from "./scanner.js";
import type { ValidationResult } from "./types.js";

const ajv = new Ajv({ strict: false });

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function readJsonFile(p: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const text = await readFile(p, "utf8");
    return { ok: true, data: JSON.parse(text) };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

function isValidJsonSchema(schema: unknown, errors: string[], label: string): boolean {
  try {
    ajv.compile(schema as object);
    return true;
  } catch (e: any) {
    errors.push(`${label} is not a valid JSON Schema: ${e.message}`);
    return false;
  }
}

export async function validateTool(name: string, root = getRoot()): Promise<ValidationResult> {
  const errors: string[] = [];
  const dir = join(root, "tools", name);

  if (!await exists(dir)) {
    return { valid: false, errors: [`Tool directory not found: ${dir}`] };
  }

  const entryPath = join(dir, "index.ts");
  if (!await exists(entryPath)) {
    errors.push(`index.ts is missing from ${dir}`);
  } else {
    const content = await readFile(entryPath, "utf8");
    if (!content.trim()) errors.push("index.ts is empty");
  }

  const schemaPath = join(dir, "schema.json");
  if (await exists(schemaPath)) {
    const result = await readJsonFile(schemaPath);
    if (!result.ok) {
      errors.push(`schema.json is not valid JSON: ${result.error}`);
    } else {
      const s = result.data as any;
      if (typeof s !== "object" || s === null) {
        errors.push("schema.json must be an object");
      } else {
        if (!s.input) errors.push("schema.json is missing 'input' field");
        else isValidJsonSchema(s.input, errors, "schema.json input");
        if (!s.output) errors.push("schema.json is missing 'output' field");
        else isValidJsonSchema(s.output, errors, "schema.json output");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function validateCommand(name: string, root = getRoot()): Promise<ValidationResult> {
  const errors: string[] = [];
  const dir = join(root, "commands", name);

  if (!await exists(dir)) {
    return { valid: false, errors: [`Command directory not found: ${dir}`] };
  }

  const entryPath = join(dir, "index.ts");
  if (!await exists(entryPath)) {
    errors.push(`index.ts is missing from ${dir}`);
  } else {
    const content = await readFile(entryPath, "utf8");
    if (!content.trim()) errors.push("index.ts is empty");
  }

  const schemaPath = join(dir, "schema.json");
  if (await exists(schemaPath)) {
    const result = await readJsonFile(schemaPath);
    if (!result.ok) {
      errors.push(`schema.json is not valid JSON: ${result.error}`);
    } else {
      if (typeof result.data !== "object" || result.data === null) {
        errors.push("schema.json must be an object");
      } else {
        isValidJsonSchema(result.data, errors, "schema.json");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function validatePlugin(name: string, root = getRoot()): Promise<ValidationResult> {
  const errors: string[] = [];
  const dir = join(root, "plugins", name);

  if (!await exists(dir)) {
    return { valid: false, errors: [`Plugin directory not found: ${dir}`] };
  }

  const entryPath = join(dir, "index.ts");
  if (!await exists(entryPath)) {
    errors.push(`index.ts is missing from ${dir}`);
  } else {
    const content = await readFile(entryPath, "utf8");
    if (!content.trim()) errors.push("index.ts is empty");
  }

  const manifestPath = join(dir, "manifest.json");
  if (!await exists(manifestPath)) {
    errors.push("manifest.json is missing");
  } else {
    const result = await readJsonFile(manifestPath);
    if (!result.ok) {
      errors.push(`manifest.json is not valid JSON: ${result.error}`);
    } else {
      const m = result.data as any;
      if (!m.name) errors.push("manifest.json is missing 'name'");
      if (!m.version) errors.push("manifest.json is missing 'version'");
      if (!m.entry) errors.push("manifest.json is missing 'entry'");
      else if (!await exists(join(dir, m.entry))) {
        errors.push(`manifest.json 'entry' file not found: ${m.entry}`);
      }
      if (m.dependencies !== undefined) {
        if (!Array.isArray(m.dependencies) || m.dependencies.some((d: unknown) => typeof d !== "string")) {
          errors.push("manifest.json 'dependencies' must be an array of strings");
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
