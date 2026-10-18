export type ToolExecutionStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'REJECTED'
  | 'FAILED'
  | 'STALE'
  | 'UNAVAILABLE';

export interface ToolExecutionResult {
  readonly status: ToolExecutionStatus;
  readonly result?: unknown | undefined;
  readonly warnings: readonly string[];
  readonly durationMs: number;
  readonly knowledgeVersion?: string | undefined;
  readonly contextVersion?: string | undefined;
  readonly freshness?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
