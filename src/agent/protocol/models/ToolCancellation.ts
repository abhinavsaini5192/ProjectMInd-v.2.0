export type ToolCancellationStatus = 'RUNNING' | 'CANCELLING' | 'CANCELLED';

export interface ToolCancellationRequest {
  readonly requestId: string;
  readonly agentId: string;
  readonly reason?: string | undefined;
}

export interface ToolCancellationResult {
  readonly requestId: string;
  readonly status: ToolCancellationStatus;
  readonly cancelledAt: string;
}
