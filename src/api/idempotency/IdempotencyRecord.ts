export type IdempotencyStatus = 'IN_FLIGHT' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord {
  readonly key: string;
  readonly principalId: string;
  readonly endpoint: string;
  readonly requestHash: string;
  readonly status: IdempotencyStatus;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly responseStatus?: number | undefined;
  readonly responseHeaders?: Record<string, string> | undefined;
  readonly responseBody?: unknown | undefined;
  readonly error?: unknown | undefined;
}
