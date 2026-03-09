/**
 * Rosetta Semantic Types
 *
 * Types designed for LLM consumption, not just compiler validation.
 * Each type carries semantic meaning that helps agents reason.
 */

// ============================================
// Rosetta Schema & Bundling Types
// ============================================

/** Tool record from scanning */
export interface ToolRecord {
  name: string;
  server: string;
  description?: string;
  schema: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    mcp_dependencies?: Record<string, unknown>;
  };
  tags?: string[];
}

/** Server record in the schema */
export interface ServerRecord {
  name: string;
  type: "local" | "remote";
  description: string;
}

/** Enhanced tool definition in bundle */
export interface EnhancedToolDefinition extends ToolRecord {
  name: string;
  server: string;
  description?: string;
  schema: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    mcp_dependencies?: Record<string, unknown>;
  };
  tags?: string[];
}

/** Complete rosetta schema */
export interface RosettaSchema {
  version: string;
  generatedAt: string;
  typeRegistry: Record<string, unknown>;
  tools: EnhancedToolDefinition[];
  servers: ServerRecord[];
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Natural language description of what the agent is looking for */
export type Intent = string;

/** A file path with semantic context */
export interface AnnotatedPath {
  path: string;
  /** File/directory name */
  name: string;
  /** "file" | "directory" */
  type: "file" | "directory";
  /** File size in bytes (files only) */
  size?: number;
  /** Number of lines (files only) */
  lines?: number;
  /** File extension without dot */
  extension?: string;
}

/** Directory tree formatted for LLM reasoning */
export interface DirectoryTree {
  /** Root path that was surveyed */
  root: string;
  /** ASCII tree representation */
  tree: string;
  /** Total files found */
  fileCount: number;
  /** Total directories found */
  dirCount: number;
}

/** File sample for context */
export interface FileSample {
  path: string;
  /** First N lines of file */
  head: string;
  /** Total line count */
  totalLines: number;
}

/** Complete survey result - structured for LLM reasoning */
export interface SurveyResult {
  /** The directory tree visualization */
  directory: DirectoryTree;
  /** Optional file samples for deeper context */
  samples?: FileSample[];
  /** Summary statistics */
  stats: {
    totalFiles: number;
    totalDirs: number;
    /** File extensions found with counts */
    extensions: Record<string, number>;
  };
}

/** Result of a file read operation */
export interface FileContent {
  path: string;
  content: string;
  lines: number;
  size: number;
}

/** Result of a write operation */
export interface WriteResult {
  path: string;
  success: boolean;
  bytesWritten: number;
}

// ============================================
// Flowbot Semantic Types
// ============================================

/** Human-readable workflow state summary */
export interface FlowSummary {
  /** Flow instance ID */
  id: string;
  /** Flow definition name */
  name: string;
  /** Current state in plain language */
  currentState: string;
  /** Plain language description of where we are */
  summary: string;
  /** Available next steps */
  availableTransitions: TransitionOption[];
  /** How many steps taken */
  stepCount: number;
}

/** A possible transition from current state */
export interface TransitionOption {
  /** Target state name */
  target: string;
  /** Human-readable condition */
  condition: string;
  /** What context variables are needed */
  requires?: string[];
}

/** Structured error with guidance */
export interface FlowError {
  error: string;
  /** Current state when error occurred */
  state: string;
  /** What transitions were available */
  availableTransitions: TransitionOption[];
  /** Hint for how to fix */
  hint: string;
}

/** Flow definition overview for discovery */
export interface FlowOverview {
  name: string;
  description: string;
  initialState: string;
  stateCount: number;
  states: string[];
}

// ============================================
// Grounder Semantic Types
// ============================================

/** Overall system health summary */
export interface SystemHealth {
  /** Total tools tracked */
  toolCount: number;
  /** Total calls across all tools */
  totalCalls: number;
  /** System-wide error rate */
  overallErrorRate: number;
  /** Average response time across all tools */
  averageDuration: number;
  /** Health assessment */
  status: "healthy" | "degraded" | "critical";
  /** Plain language summary */
  summary: string;
}

/** Tool performance ranking */
export interface ToolRanking {
  name: string;
  rank: number;
  metric: string;
  value: number;
  comparison: string;  // "faster than average", "high error rate", etc.
}

/** Time window for queries */
export type TimeWindow = "last_hour" | "last_day" | "last_week" | "all_time";

/** Semantic duration input */
export type SemanticDuration = "instant" | "fast" | "normal" | "slow" | "timeout" | number;

/** Error breakdown */
export interface ErrorBreakdown {
  message: string;
  count: number;
  percentage: number;
  lastOccurred: string;
}

/** Enhanced tool metrics with insights */
export interface ToolInsights {
  name: string;
  /** Plain language performance summary */
  summary: string;
  /** Call statistics */
  calls: {
    total: number;
    successful: number;
    failed: number;
  };
  /** Timing statistics */
  timing: {
    average: number;
    assessment: "instant" | "fast" | "normal" | "slow";
  };
  /** Error analysis */
  errors: {
    rate: number;
    breakdown: ErrorBreakdown[];
  };
  /** Comparison to other tools */
  comparison: string;
}
