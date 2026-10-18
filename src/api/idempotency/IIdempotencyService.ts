import type { IdempotencyRecord } from './IdempotencyRecord.js';

export interface IdempotencyCheckResult {
  readonly isReplay: boolean;
  readonly record?: IdempotencyRecord | undefined;
}

export interface IIdempotencyService {
  beginOperation(
    key: string,
    principalId: string,
    endpoint: string,
    payload: unknown,
    ttlMs?: number
  ): Promise<IdempotencyCheckResult>;

  completeOperation(
    key: string,
    responseStatus: number,
    responseHeaders: Record<string, string>,
    responseBody: unknown
  ): Promise<void>;

  failOperation(key: string, error: unknown): Promise<void>;
}
