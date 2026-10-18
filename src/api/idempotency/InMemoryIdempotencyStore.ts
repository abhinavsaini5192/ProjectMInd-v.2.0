import type { IIdempotencyStore } from './IIdempotencyStore.js';
import type { IdempotencyRecord } from './IdempotencyRecord.js';

export class InMemoryIdempotencyStore implements IIdempotencyStore {
  private readonly records: Map<string, IdempotencyRecord> = new Map();

  public async get(key: string): Promise<IdempotencyRecord | undefined> {
    const record = this.records.get(key);
    if (!record) return undefined;

    if (Date.now() > record.expiresAt) {
      this.records.delete(key);
      return undefined;
    }

    return record;
  }

  public async save(record: IdempotencyRecord): Promise<void> {
    this.records.set(record.key, record);
  }

  public async delete(key: string): Promise<void> {
    this.records.delete(key);
  }

  public async clear(): Promise<void> {
    this.records.clear();
  }
}
