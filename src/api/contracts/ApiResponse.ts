import type { ApiMetadata } from './ApiMetadata.js';
import type { PaginationMetadata } from './ApiPagination.js';

export interface ApiResponse<TData = any> {
  readonly status: number;
  readonly headers?: Record<string, string> | undefined;
  readonly data: TData;
  readonly meta: ApiMetadata;
}

export interface PaginatedApiResponse<TItem = unknown> extends ApiResponse<readonly TItem[]> {
  readonly data: readonly TItem[];
  readonly meta: ApiMetadata & { readonly pagination: PaginationMetadata };
}

export function createApiResponse<TData>(
  data: TData,
  meta: {
    readonly requestId: string;
    readonly correlationId: string;
    readonly apiVersion: string;
    readonly durationMs?: number | undefined;
    readonly pagination?: PaginationMetadata | undefined;
    readonly warnings?: readonly string[] | undefined;
  },
  status: number = 200,
  headers?: Record<string, string>
): ApiResponse<TData> {
  return {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    data,
    meta: {
      requestId: meta.requestId,
      correlationId: meta.correlationId,
      apiVersion: meta.apiVersion,
      timestamp: Date.now(),
      durationMs: meta.durationMs,
      pagination: meta.pagination,
      warnings: meta.warnings,
    },
  };
}
