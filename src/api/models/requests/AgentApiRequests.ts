export interface CreateAgentSessionRequestBody {
  readonly agentId?: string | undefined;
  readonly name?: string | undefined;
  readonly capabilities?: readonly string[] | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface SubmitAgentTaskRequestBody {
  readonly taskId?: string | undefined;
  readonly description?: string | undefined;
  readonly prompt?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface CancelAgentTaskRequestBody {
  readonly reason?: string | undefined;
}

export interface CompleteAgentTaskRequestBody {
  readonly result?: unknown | undefined;
  readonly summary?: string | undefined;
  readonly evidence?: readonly unknown[] | undefined;
}

export interface RefreshTaskContextRequestBody {
  readonly reason?: string | undefined;
  readonly options?: Record<string, unknown> | undefined;
}
