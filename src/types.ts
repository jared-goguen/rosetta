export interface ToolDefinition {
  name: string;
  description?: string;
  schema: { input: object; output: object } | null;
}

export interface CommandDefinition {
  name: string;
  description?: string;
  schema: object | null;
}

export interface PluginDefinition {
  name: string;
  version: string;
  description?: string;
  dependencies: string[];
  enabled: boolean;
}

export interface ServerDefinition {
  name: string;
  type: "local" | "remote";
  location?: string;
  url?: string;
  description?: string;
  tools: string[];
  enabled: boolean;
}

export interface EnhancedToolDefinition {
  name: string;
  server: string;
  description?: string;
  schema: { input: object; output: object };
}

export interface RosettaSchema {
  version: string;
  generatedAt: string;
  typeRegistry?: Record<string, any>;
  tools: EnhancedToolDefinition[];
  servers: ServerRecord[];
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  entry: string;
  dependencies?: string[];
  enabled?: boolean;
}

export interface ToolRecord {
  name: string;
  server: string;
  description?: string;
  schema: { input: object; output: object };
}

export interface CommandRecord {
  name: string;
  path: string;
  content: string;
  description?: string;
  schema?: object;
}

export interface PluginRecord {
  name: string;
  path: string;
  manifest: PluginManifest;
  content: string;
  files: string[];
}

export interface ServerRecord {
  name: string;
  type: "local" | "remote";
  description?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
