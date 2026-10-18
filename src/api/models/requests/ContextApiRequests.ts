export interface OrchestrateContextRequestBody {
  readonly query: string;
  readonly taskType?: string | undefined;
  readonly featureId?: string | undefined;
  readonly budget?: {
    readonly maxTokens?: number | undefined;
  } | undefined;
  readonly files?: readonly string[] | undefined;
  readonly options?: Record<string, unknown> | undefined;
}

export interface ContextPlanRequestBody {
  readonly query: string;
  readonly featureId?: string | undefined;
  readonly budget?: {
    readonly maxTokens?: number | undefined;
  } | undefined;
}

export interface ContextEstimateRequestBody {
  readonly query: string;
  readonly files?: readonly string[] | undefined;
  readonly featureId?: string | undefined;
}
