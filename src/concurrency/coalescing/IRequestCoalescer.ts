export interface CoalesceKeyOptions {
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly principalId?: string | undefined;
  readonly securityScopes?: readonly string[] | undefined;
  readonly knowledgeVersion?: number | string | undefined;
  readonly operation: string;
  readonly parameters?: Record<string, unknown> | undefined;
}

export interface IRequestCoalescer {
  /**
   * Executes or attaches to an existing in-flight computation for the specified key.
   */
  coalesce<T>(key: string, compute: () => Promise<T>): Promise<T>;

  /**
   * Checks if a computation is currently in-flight for the given key.
   */
  isInFlight(key: string): boolean;

  /**
   * Current count of in-flight unique computations.
   */
  activeCount(): number;

  /**
   * Builds a deterministic, security-aware coalescing key.
   */
  buildKey(options: CoalesceKeyOptions): string;
}
