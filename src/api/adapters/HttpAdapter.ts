import * as http from 'http';
import type { IApiService } from '../services/IApiService.js';
import { RequestService } from '../services/RequestService.js';
import type { HttpMethod } from '../contracts/ApiRequest.js';

export interface CorsOptions {
  readonly allowedOrigins?: readonly string[] | undefined;
  readonly allowCredentials?: boolean | undefined;
  readonly allowedHeaders?: readonly string[] | undefined;
  readonly allowedMethods?: readonly string[] | undefined;
}

export interface SecurityHeaderOptions {
  readonly enableHsts?: boolean | undefined;
  readonly enableCsp?: boolean | undefined;
  readonly frameOptions?: string | undefined;
}

export interface HttpAdapterOptions {
  readonly maxBodySizeBytes?: number | undefined; // Default 10 MB
  readonly cors?: CorsOptions | undefined;
  readonly securityHeaders?: SecurityHeaderOptions | undefined;
}

export class HttpAdapter {
  private readonly maxBodySizeBytes: number;
  private readonly requestService: RequestService;
  private readonly corsConfig?: CorsOptions | undefined;
  private readonly securityHeaderConfig?: SecurityHeaderOptions | undefined;

  public constructor(
    private readonly apiService: IApiService,
    options?: HttpAdapterOptions | undefined
  ) {
    this.maxBodySizeBytes = options?.maxBodySizeBytes ?? 10 * 1024 * 1024; // 10MB default
    this.corsConfig = options?.cors;
    this.securityHeaderConfig = options?.securityHeaders;
    this.requestService = new RequestService();
  }

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const method = (req.method?.toUpperCase() ?? 'GET') as HttpMethod;
      const fullUrl = req.url ?? '/';
      const [path, queryString] = fullUrl.split('?');

      // 1. CORS Preflight OPTIONS handler
      if (method === 'OPTIONS') {
        const corsHeaders = this.computeCorsHeaders(req);
        const headers: Record<string, string> = {
          ...this.getDefaultSecurityHeaders(),
          ...corsHeaders,
          'access-control-allow-methods': (
            this.corsConfig?.allowedMethods ?? ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
          ).join(', '),
          'access-control-allow-headers': (
            this.corsConfig?.allowedHeaders ?? [
              'Authorization',
              'Content-Type',
              'X-API-Key',
              'X-Session-ID',
              'X-Request-ID',
              'X-Correlation-ID',
              'X-Dev-Principal-ID',
            ]
          ).join(', '),
          'access-control-max-age': '86400',
        };
        res.writeHead(204, headers);
        res.end();
        return;
      }

      // 2. Parse query string safely
      const query: Record<string, string | undefined> = {};
      if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        for (const [key, value] of searchParams.entries()) {
          query[key] = value;
        }
      }

      // 3. Read request body safely
      const rawBody = await this.readBody(req);
      let parsedBody: unknown = undefined;

      if (rawBody && rawBody.trim().length > 0) {
        const contentType = req.headers['content-type'] ?? '';
        if (
          contentType.includes('application/json') ||
          rawBody.trim().startsWith('{') ||
          rawBody.trim().startsWith('[')
        ) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            res.writeHead(400, {
              'content-type': 'application/problem+json',
              ...this.getDefaultSecurityHeaders(),
            });
            res.end(
              JSON.stringify({
                type: 'urn:projectmind:error:bad_request',
                title: 'Malformed JSON payload',
                status: 400,
                detail: 'The request body could not be parsed as valid JSON.',
              })
            );
            return;
          }
        } else {
          parsedBody = rawBody;
        }
      }

      // 4. Headers normalization
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
      }

      const clientIp = req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const apiRequest = this.requestService.createRequest({
        path: path || '/',
        method,
        headers,
        query,
        body: parsedBody,
        rawBody,
        clientIp,
        userAgent,
      });

      const apiResponse = await this.apiService.handle(apiRequest);

      // 5. Build response headers with security and CORS
      const corsHeaders = this.computeCorsHeaders(req);
      const responseHeaders: Record<string, string> = {
        'content-type': 'application/json',
        ...this.getDefaultSecurityHeaders(),
        ...corsHeaders,
        ...(apiResponse.headers ?? {}),
      };

      res.writeHead(apiResponse.status, responseHeaders);

      if (apiResponse.status === 204 || apiResponse.data === null) {
        res.end();
      } else {
        res.end(JSON.stringify(apiResponse));
      }
    } catch (err: unknown) {
      // Top-level crash boundary (never leak internal stack trace)
      res.writeHead(500, {
        'content-type': 'application/problem+json',
        ...this.getDefaultSecurityHeaders(),
      });
      res.end(
        JSON.stringify({
          type: 'urn:projectmind:error:internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unhandled server exception occurred.',
        })
      );
    }
  }

  public getDefaultSecurityHeaders(): Record<string, string> {
    const secHeaders: Record<string, string> = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': this.securityHeaderConfig?.frameOptions ?? 'DENY',
      'x-xss-protection': '0',
      'referrer-policy': 'strict-origin-when-cross-origin',
    };

    if (this.securityHeaderConfig?.enableHsts !== false) {
      secHeaders['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
    }

    if (this.securityHeaderConfig?.enableCsp !== false) {
      secHeaders['content-security-policy'] = "default-src 'self'";
    }

    return secHeaders;
  }

  private computeCorsHeaders(req: http.IncomingMessage): Record<string, string> {
    const origin = req.headers['origin'];
    if (!origin || !this.corsConfig) return {};

    const { allowedOrigins = ['*'], allowCredentials = false } = this.corsConfig;
    const corsHeaders: Record<string, string> = {};

    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

    if (isAllowed) {
      if (allowCredentials) {
        // Per W3C CORS standard, wildcards are strictly prohibited when credentials are true
        corsHeaders['access-control-allow-origin'] = origin;
        corsHeaders['access-control-allow-credentials'] = 'true';
      } else {
        corsHeaders['access-control-allow-origin'] = allowedOrigins.includes('*') ? '*' : origin;
      }
      corsHeaders['vary'] = 'Origin';
    }

    return corsHeaders;
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!req || typeof (req as any).on !== 'function') {
        resolve('');
        return;
      }
      let data = '';
      let bytesCount = 0;

      req.on('data', (chunk: Buffer | string) => {
        bytesCount += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
        if (bytesCount > this.maxBodySizeBytes) {
          req.destroy(new Error(`Payload Too Large: exceeded ${this.maxBodySizeBytes} bytes`));
          reject(new Error(`Payload Too Large: exceeded ${this.maxBodySizeBytes} bytes`));
          return;
        }
        data += chunk;
      });

      req.on('end', () => resolve(data));
      req.on('error', (err) => reject(err));
    });
  }

  public createServer(): http.Server {
    return http.createServer((req, res) => {
      this.handleRequest(req, res).catch(() => {
        if (!res.headersSent) {
          res.writeHead(500, this.getDefaultSecurityHeaders());
          res.end();
        }
      });
    });
  }
}
