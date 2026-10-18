import type { ApiResponse, PaginatedApiResponse } from '../contracts/ApiResponse.js';
import type { PaginationMetadata, PaginationParams } from '../contracts/ApiPagination.js';
import { encodeCursor } from '../contracts/ApiPagination.js';
import type { ApiRequestContext } from '../contracts/ApiRequestContext.js';
import { ApiError } from '../errors/ApiError.js';
import { ApiErrorMapper } from '../errors/ApiErrorMapper.js';

export class ResponseService {
  public static success<T>(
    context: ApiRequestContext,
    data: T,
    status: number = 200,
    headers?: Record<string, string>,
    warnings?: readonly string[]
  ): ApiResponse<T> {
    const durationMs = Date.now() - context.receivedAt;
    return {
      status,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      data,
      meta: {
        requestId: context.requestId,
        correlationId: context.correlationId,
        apiVersion: context.apiVersion,
        timestamp: Date.now(),
        durationMs,
        warnings,
      },
    };
  }

  public static paginated<T>(
    context: ApiRequestContext,
    items: readonly T[],
    paginationParams: PaginationParams,
    options?: {
      hasMore?: boolean;
      totalCount?: number;
      cursorGenerator?: (item: T) => Record<string, unknown> | string | number;
    }
  ): PaginatedApiResponse<T> {
    const durationMs = Date.now() - context.receivedAt;
    const hasMore = options?.hasMore ?? (items.length >= paginationParams.limit);

    let nextCursor: string | null = null;
    let prevCursor: string | null = null;

    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1]!;
      const cursorPayload = options?.cursorGenerator ? options.cursorGenerator(lastItem) : { index: items.length };
      nextCursor = encodeCursor(cursorPayload);
    }

    if (paginationParams.cursor) {
      prevCursor = paginationParams.cursor;
    }

    const paginationMeta: PaginationMetadata = {
      cursor: paginationParams.cursor,
      nextCursor,
      prevCursor,
      hasMore,
      totalCount: options?.totalCount,
      limit: paginationParams.limit,
    };

    return {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
      data: items,
      meta: {
        requestId: context.requestId,
        correlationId: context.correlationId,
        apiVersion: context.apiVersion,
        timestamp: Date.now(),
        durationMs,
        pagination: paginationMeta,
      },
    };
  }

  public static error(
    context: ApiRequestContext,
    error: unknown,
    instancePath?: string
  ): ApiResponse {
    const apiError = ApiErrorMapper.map(error, {
      requestId: context.requestId,
      correlationId: context.correlationId,
      path: instancePath,
    });

    const durationMs = Date.now() - context.receivedAt;

    return {
      status: apiError.status,
      headers: {
        'content-type': 'application/problem+json',
        ...(apiError.retryAfter !== undefined ? { 'retry-after': String(apiError.retryAfter) } : {}),
      },
      data: apiError.toJSON(),
      meta: {
        requestId: context.requestId,
        correlationId: context.correlationId,
        apiVersion: context.apiVersion,
        timestamp: Date.now(),
        durationMs,
      },
    };
  }
}
