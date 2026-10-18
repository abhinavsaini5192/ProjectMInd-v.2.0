export interface PaginationParams {
  readonly cursor?: string | undefined;
  readonly limit: number;
  readonly direction: 'forward' | 'backward';
}

export interface PaginationMetadata {
  readonly cursor?: string | undefined;
  readonly nextCursor: string | null;
  readonly prevCursor: string | null;
  readonly hasMore: boolean;
  readonly totalCount?: number | undefined;
  readonly limit: number;
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export function parsePaginationParams(
  query: Record<string, string | undefined>,
  defaultLimit: number = DEFAULT_PAGE_LIMIT,
  maxLimit: number = MAX_PAGE_LIMIT
): PaginationParams {
  let limit = defaultLimit;
  if (query.limit !== undefined) {
    const parsed = parseInt(query.limit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, maxLimit);
    }
  }

  const cursor = query.cursor && query.cursor.trim().length > 0 ? query.cursor.trim() : undefined;
  const direction: 'forward' | 'backward' = query.direction === 'backward' ? 'backward' : 'forward';

  return {
    cursor,
    limit,
    direction,
  };
}

export function encodeCursor(payload: Record<string, unknown> | string | number): string {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeCursor<T = Record<string, unknown>>(cursorString: string): T {
  try {
    const raw = Buffer.from(cursorString, 'base64url').toString('utf8');
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  } catch (err: unknown) {
    throw new Error(`Invalid pagination cursor encoding: ${String(err)}`);
  }
}
