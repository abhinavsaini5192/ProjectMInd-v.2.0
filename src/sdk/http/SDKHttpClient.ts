import type { SDKClientOptions } from '../models/SDKClientOptions.js';
import {
  SDKError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  NotFoundError,
  SecurityError,
  ValidationError,
} from '../errors/SDKError.js';

export interface HttpRequestOptions {
  readonly method?: string | undefined;
  readonly path: string;
  readonly query?: Record<string, string | number | boolean | undefined> | undefined;
  readonly body?: unknown | undefined;
  readonly headers?: Record<string, string> | undefined;
  readonly timeoutMs?: number | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly isIdempotent?: boolean | undefined;
}

export class SDKHttpClient {
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

  constructor(private readonly options: SDKClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = options.timeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 3;
    this.fetchFn = options.customFetch ?? (typeof fetch !== 'undefined' ? fetch : (async () => {
      throw new SDKError('No fetch implementation available in current environment.');
    }));
  }

  public async request<T = unknown>(opts: HttpRequestOptions): Promise<T> {
    const method = (opts.method ?? 'GET').toUpperCase();
    const isIdempotent = opts.isIdempotent ?? ['GET', 'HEAD', 'PUT', 'DELETE'].includes(method);
    const correlationId = opts.headers?.['x-correlation-id'] ?? `sdk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;

    // Construct URL
    const url = new URL(`${this.baseUrl}${opts.path.startsWith('/') ? opts.path : `/${opts.path}`}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) {
          url.searchParams.append(k, String(v));
        }
      }
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-correlation-id': correlationId,
      'x-workspace-id': this.options.workspaceId,
      ...(this.options.projectId ? { 'x-project-id': this.options.projectId } : {}),
      ...(opts.headers ?? {}),
    };

    if (this.options.apiKey) {
      headers['x-api-key'] = this.options.apiKey;
    } else if (this.options.token) {
      headers['authorization'] = `Bearer ${this.options.token}`;
    }

    let attempt = 0;
    while (true) {
      attempt++;
      const controller = new AbortController();
      let timer: NodeJS.Timeout | undefined;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new TimeoutError(timeoutMs, correlationId));
        }, timeoutMs);
      });

      if (opts.signal) {
        opts.signal.addEventListener('abort', () => controller.abort());
      }

      try {
        const fetchPromise = this.fetchFn(url.toString(), {
          method,
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal,
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);
        clearTimeout(timer);

        if (!response.ok) {
          const status = response.status;
          let errorBody: any;
          try {
            errorBody = await response.json();
          } catch {
            errorBody = { message: await response.text() };
          }

          const message = errorBody?.message ?? errorBody?.error ?? `HTTP ${status} response`;

          // Handle Retryable server errors on idempotent calls
          if (isIdempotent && (status === 503 || status === 504 || status === 429) && attempt <= this.maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 100 + Math.floor(Math.random() * 50);
            await new Promise((res) => setTimeout(res, backoffMs));
            continue;
          }

          if (status === 401) throw new AuthenticationError(message, correlationId);
          if (status === 403) throw new SecurityError(message, correlationId);
          if (status === 404) throw new NotFoundError(opts.path, correlationId);
          if (status === 429) throw new RateLimitError(message, undefined, correlationId);
          if (status === 400) throw new ValidationError(message, errorBody?.validationErrors ?? [], correlationId);

          throw new SDKError(message, `HTTP_${status}`, status, correlationId);
        }

        const data = await response.json();
        return data as T;
      } catch (err: any) {
        if (timer) clearTimeout(timer);

        if (err instanceof SDKError) {
          throw err;
        }

        const isNetworkError = err.name === 'FetchError' || err.code === 'ECONNRESET' || err.message?.includes('network');
        if (isIdempotent && isNetworkError && attempt <= this.maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 100 + Math.floor(Math.random() * 50);
          await new Promise((res) => setTimeout(res, backoffMs));
          continue;
        }

        throw new SDKError(`Request failed: ${err.message}`, 'REQUEST_FAILED', undefined, correlationId);
      }
    }
  }
}
