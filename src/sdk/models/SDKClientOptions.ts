export interface SDKClientOptions {
  readonly baseUrl: string;
  readonly apiKey?: string | undefined;
  readonly token?: string | undefined;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly maxRetries?: number | undefined;
  readonly customFetch?: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined;
}

export interface PaginationParams {
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string | undefined;
}
