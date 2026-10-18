import type { IdempotencyRecord } from './IdempotencyRecord.js';

export interface IIdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | undefined>;
  save(record: IdempotencyRecord): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
