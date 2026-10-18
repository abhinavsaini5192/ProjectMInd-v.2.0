import { createHash } from 'crypto';
import type { IIdempotencyStore } from './IIdempotencyStore.js';
import type { IdempotencyCheckResult, IIdempotencyService } from './IIdempotencyService.js';
import type { IdempotencyRecord } from './IdempotencyRecord.js';
import { ApiError } from '../errors/ApiError.js';

export const DEFAULT_IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class IdempotencyService implements IIdempotencyService {
  constructor(private readonly store: IIdempotencyStore) {}

  public async beginOperation(
    key: string,
    principalId: string,
    endpoint: string,
    payload: unknown,
    ttlMs: number = DEFAULT_IDEMPOTENCY_TTL_MS
  ): Promise<IdempotencyCheckResult> {
    const requestHash = this.computeHash(payload);
    const existing = await this.store.get(key);

    if (existing) {
      // Check ownership
      if (existing.principalId !== principalId) {
        throw ApiError.forbidden('Idempotency key belongs to another principal');
      }

      // Check endpoint match
      if (existing.endpoint !== endpoint) {
        throw ApiError.conflict('Idempotency key reused on different endpoint');
      }

      // Check payload hash match
      if (existing.requestHash !== requestHash) {
        throw ApiError.conflict('Idempotency key reused with different request payload');
      }

      // In flight check
      if (existing.status === 'IN_FLIGHT') {
        throw ApiError.idempotencyConflict('A request with this idempotency key is currently in progress');
      }

      // Completed check
      if (existing.status === 'COMPLETED') {
        return {
          isReplay: true,
          record: existing,
        };
      }

      // If failed, allow retry by overwriting
    }

    const now = Date.now();
    const record: IdempotencyRecord = {
      key,
      principalId,
      endpoint,
      requestHash,
      status: 'IN_FLIGHT',
      createdAt: now,
      expiresAt: now + ttlMs,
    };

    await this.store.save(record);
    return { isReplay: false };
  }

  public async completeOperation(
    key: string,
    responseStatus: number,
    responseHeaders: Record<string, string>,
    responseBody: unknown
  ): Promise<void> {
    const existing = await this.store.get(key);
    if (!existing) return;

    const updated: IdempotencyRecord = {
      ...existing,
      status: 'COMPLETED',
      responseStatus,
      responseHeaders,
      responseBody,
    };

    await this.store.save(updated);
  }

  public async failOperation(key: string, error: unknown): Promise<void> {
    const existing = await this.store.get(key);
    if (!existing) return;

    const updated: IdempotencyRecord = {
      ...existing,
      status: 'FAILED',
      error: error instanceof Error ? error.message : String(error),
    };

    await this.store.save(updated);
  }

  private computeHash(payload: unknown): string {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    return createHash('sha256').update(serialized).digest('hex');
  }
}
