export type PluginExecutionStatus = 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'CANCELLED';

export interface PluginExecutionRecord {
  readonly executionId: string;
  readonly pluginId: string;
  readonly operation: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly status: PluginExecutionStatus;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMs: number;
  readonly correlationId: string;
  readonly errorCategory?: string | undefined;
  readonly errorMessage?: string | undefined;
}
