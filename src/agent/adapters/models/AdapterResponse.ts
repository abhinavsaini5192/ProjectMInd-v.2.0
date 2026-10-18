import type { AdapterError } from './AdapterError.js';

export type AdapterResponseStatus = 'SUCCESS' | 'ERROR' | 'PARTIAL';

export interface AdapterResponseMetadata {
  readonly durationMs: number;
  readonly timestamp: string;
  readonly protocolVersion: string;
  readonly adapterVersion: string;
  readonly knowledgeVersion?: string | undefined;
  readonly freshness?: string | undefined;
  readonly traceId?: string | undefined;
  readonly tokensUsed?: number | undefined;
}

export interface AdapterResponse<TData = unknown> {
  readonly requestId: string;
  readonly providerRequestId?: string | undefined;
  readonly adapterId: string;
  readonly status: AdapterResponseStatus;
  readonly data?: TData | undefined;
  readonly error?: AdapterError | undefined;
  readonly warnings: readonly string[];
  readonly metadata: AdapterResponseMetadata;
}
