import type { IRequestCoalescer, CoalesceKeyOptions } from './IRequestCoalescer.js';

export class RequestCoalescer implements IRequestCoalescer {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private totalCoalescedCount = 0;

  public get totalCoalesced(): number {
    return this.totalCoalescedCount;
  }

  public isInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  public activeCount(): number {
    return this.inFlight.size;
  }

  public buildKey(options: CoalesceKeyOptions): string {
    const sortedScopes = (options.securityScopes ?? []).slice().sort().join(',');
    const serializedParams = options.parameters
      ? JSON.stringify(options.parameters, Object.keys(options.parameters).sort())
      : '';

    return [
      `ws:${options.workspaceId}`,
      `repo:${options.repositoryId}`,
      options.principalId ? `actor:${options.principalId}` : '',
      sortedScopes ? `scopes:${sortedScopes}` : '',
      options.knowledgeVersion !== undefined ? `kv:${options.knowledgeVersion}` : '',
      `op:${options.operation}`,
      serializedParams ? `params:${serializedParams}` : '',
    ]
      .filter(Boolean)
      .join('|');
  }

  public async coalesce<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      this.totalCoalescedCount++;
      return existing as Promise<T>;
    }

    const promise = (async () => {
      try {
        return await compute();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }
}
