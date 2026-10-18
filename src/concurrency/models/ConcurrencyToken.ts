/**
 * Stable, provider-neutral concurrency token for optimistic concurrency control.
 */
export interface ConcurrencyToken {
  readonly resourceId: string;
  readonly version: number;
  readonly generatedAt: number;
  readonly source: string;
}

export function createConcurrencyToken(
  resourceId: string,
  version: number,
  source: string = 'internal'
): ConcurrencyToken {
  return {
    resourceId,
    version,
    generatedAt: Date.now(),
    source,
  };
}
