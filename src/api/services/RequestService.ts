import { randomUUID } from 'crypto';
import type { ApiRequest, HttpMethod } from '../contracts/ApiRequest.js';
import type { ApiRequestContext } from '../contracts/ApiRequestContext.js';
import { DEFAULT_API_VERSION } from '../versioning/ApiVersion.js';
import { VersionResolver } from '../versioning/VersionResolver.js';
import type { SecurityPrincipal } from '../../security/models/SecurityPrincipal.js';
import type { SecurityContext } from '../../security/models/SecurityContext.js';

export interface CreateRawApiRequestOptions {
  readonly path: string;
  readonly method: HttpMethod;
  readonly headers?: Record<string, string | undefined> | undefined;
  readonly query?: Record<string, string | undefined> | undefined;
  readonly body?: unknown;
  readonly rawBody?: string | undefined;
  readonly clientIp?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly context?: Partial<ApiRequestContext> | undefined;
}

export class RequestService {
  private readonly versionResolver = new VersionResolver();

  public createRequest(options: CreateRawApiRequestOptions): ApiRequest {
    const headers = options.headers ?? {};
    const query = options.query ?? {};

    // 1. Resolve correlation and request IDs
    const rawCorrId =
      headers['x-correlation-id'] ||
      headers['X-Correlation-ID'] ||
      headers['correlation-id'];
    const correlationId =
      typeof rawCorrId === 'string' && rawCorrId.trim().length > 0
        ? rawCorrId.trim()
        : randomUUID();

    const rawReqId =
      headers['x-request-id'] ||
      headers['X-Request-ID'] ||
      headers['request-id'];
    const requestId =
      typeof rawReqId === 'string' && rawReqId.trim().length > 0
        ? rawReqId.trim()
        : randomUUID();

    // 2. Resolve version from path or headers
    const versionResult = this.versionResolver.resolve(options.path, headers);

    // 3. Anonymous/placeholder initial security principal
    const anonymousPrincipal: SecurityPrincipal = {
      principalId: 'anonymous',
      type: 'USER',
      identityId: 'anonymous',
      status: 'ACTIVE',
      authenticationMethod: 'UNKNOWN',
      createdAt: new Date().toISOString(),
    };

    const initialSecurityContext: SecurityContext = {
      principal: anonymousPrincipal,
      permissions: [],
      capabilities: [],
      authenticationMethod: 'UNKNOWN',
      trustLevel: 'UNTRUSTED',
      requestId,
      correlationId,
      createdAt: new Date().toISOString(),
    };

    const idempotencyKey =
      headers['idempotency-key'] ||
      headers['Idempotency-Key'] ||
      headers['x-idempotency-key'] ||
      headers['X-Idempotency-Key'];

    const context: ApiRequestContext = {
      requestId,
      correlationId,
      apiVersion: versionResult.version,
      receivedAt: Date.now(),
      principal: anonymousPrincipal,
      securityContext: initialSecurityContext,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey.trim() : undefined,
      clientIp: options.clientIp,
      userAgent: options.userAgent,
      ...options.context,
    };

    return {
      path: options.path,
      method: options.method,
      params: {},
      query,
      headers,
      body: options.body,
      rawBody: options.rawBody,
      context,
    };
  }
}
