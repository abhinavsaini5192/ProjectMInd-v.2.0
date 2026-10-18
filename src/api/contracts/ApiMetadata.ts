import type { PaginationMetadata } from './ApiPagination.js';

export interface ApiMetadata {
  readonly requestId: string;
  readonly correlationId: string;
  readonly apiVersion: string;
  readonly timestamp: number;
  readonly durationMs?: number | undefined;
  readonly pagination?: PaginationMetadata | undefined;
  readonly warnings?: readonly string[] | undefined;
}
