export interface LogSanitizerOptions {
  readonly customSensitiveKeys?: readonly string[] | undefined;
  readonly maskText?: string | undefined;
  readonly maxStringLength?: number | undefined;
  readonly escapeNewlinesInMessages?: boolean | undefined;
}

export class LogSanitizer {
  private static readonly DEFAULT_SENSITIVE_KEYS = new Set([
    'password',
    'passwd',
    'secret',
    'token',
    'access_token',
    'refresh_token',
    'id_token',
    'api_key',
    'apikey',
    'private_key',
    'privatekey',
    'authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'client_secret',
    'credential',
    'credentials',
    'ssn',
    'credit_card',
    'jwt',
    'session_token',
    'auth_header',
  ]);

  private static readonly SENSITIVE_PATTERNS = [
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    /Basic\s+[A-Za-z0-9+/]+=*/gi,
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----[^-]+-----END [A-Z ]+ PRIVATE KEY-----/gs,
    /AIza[0-9A-Za-z\-_]{35}/g,                                             // Google API key
    /sk-[0-9A-Za-z]{10,}/g,                                                // OpenAI API key
    /sk-ant-[0-9A-Za-z\-_]{20,}/g,                                         // Anthropic API key
    /ghp_[0-9A-Za-z]{36}/g,                                                // GitHub PAT
    /github_pat_[0-9A-Za-z_]{82}/g,                                        // GitHub Fine-grained PAT
    /xox[baprs]-[0-9A-Za-z]{10,48}/g,                                      // Slack token
    /AKIA[0-9A-Z]{16}/g,                                                   // AWS Access Key ID
    /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,                // JWT token
    /(:\/\/[^:]+:)([^@]+)(@)/g,                                            // URI embedded credentials (e.g. postgres://user:password@host)
    /(token|password|secret|apikey|api_key|credential)\s*[:= ]\s*['"]?[A-Za-z0-9\-_.]+['"]?/gi,
  ];

  private readonly sensitiveKeys: Set<string>;
  private readonly maskText: string;
  private readonly maxStringLength: number;
  private readonly escapeNewlinesInMessages: boolean;

  constructor(options: LogSanitizerOptions = {}) {
    this.sensitiveKeys = new Set(LogSanitizer.DEFAULT_SENSITIVE_KEYS);
    if (options.customSensitiveKeys) {
      for (const k of options.customSensitiveKeys) {
        this.sensitiveKeys.add(k.toLowerCase());
      }
    }
    this.maskText = options.maskText ?? '[REDACTED]';
    this.maxStringLength = options.maxStringLength ?? 4096;
    this.escapeNewlinesInMessages = options.escapeNewlinesInMessages ?? true;
  }

  public sanitize<T>(data: T, depth: number = 0, seen: Set<object> = new Set()): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (depth > 10) {
      return '[MAX_DEPTH_REACHED]' as unknown as T;
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data) as unknown as T;
    }

    if (typeof data === 'number' || typeof data === 'boolean' || typeof data === 'symbol') {
      return data;
    }

    if (typeof data === 'object') {
      if (seen.has(data as object)) {
        return '[CIRCULAR]' as unknown as T;
      }
      seen.add(data as object);

      if (Array.isArray(data)) {
        return data.map((item) => this.sanitize(item, depth + 1, seen)) as unknown as T;
      }

      const sanitizedObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (this.isSensitiveKey(key)) {
          sanitizedObj[key] = this.maskText;
        } else {
          sanitizedObj[key] = this.sanitize(value, depth + 1, seen);
        }
      }
      return sanitizedObj as T;
    }

    return data;
  }

  public sanitizeString(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let result = text;
    for (const pattern of LogSanitizer.SENSITIVE_PATTERNS) {
      if (pattern.source.includes('[^@]+')) {
        result = result.replace(pattern, `$1${this.maskText}$3`);
      } else {
        result = result.replace(pattern, this.maskText);
      }
    }

    if (result.length > this.maxStringLength) {
      return result.substring(0, this.maxStringLength) + '... [TRUNCATED]';
    }
    return result;
  }

  /**
   * Sanitizes a log message string and prevents multiline log injection forgery (CWE-117).
   */
  public sanitizeLogMessage(message: string): string {
    const sanitized = this.sanitizeString(message);
    if (this.escapeNewlinesInMessages) {
      return sanitized.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
    }
    return sanitized;
  }

  public sanitizeHeaders(headers: Record<string, string | undefined>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (v === undefined) continue;
      if (this.isSensitiveKey(k)) {
        sanitized[k] = this.maskText;
      } else {
        sanitized[k] = this.sanitizeString(v);
      }
    }
    return sanitized;
  }

  public isSensitiveKey(key: string): boolean {
    const lower = key.toLowerCase();
    const normalized = lower.replace(/[-_]/g, '');
    return (
      this.sensitiveKeys.has(lower) ||
      this.sensitiveKeys.has(normalized) ||
      normalized.includes('token') ||
      normalized.includes('secret') ||
      normalized.includes('password') ||
      normalized.includes('passwd') ||
      normalized.includes('apikey') ||
      normalized.includes('privatekey') ||
      normalized.includes('creditcard') ||
      normalized.includes('ssn')
    );
  }

  public sanitizeMessage(message: string): string {
    return this.sanitizeLogMessage(message);
  }

  public static sanitize<T>(data: T): T {
    return defaultLogSanitizer.sanitize(data);
  }

  public static sanitizeMessage(message: string): string {
    return defaultLogSanitizer.sanitizeLogMessage(message);
  }

  public static sanitizeLogMessage(message: string): string {
    return defaultLogSanitizer.sanitizeLogMessage(message);
  }

  public static sanitizeString(text: string): string {
    return defaultLogSanitizer.sanitizeString(text);
  }

  public static sanitizeMetadata<T extends Record<string, unknown>>(data: T): T {
    return defaultLogSanitizer.sanitize(data);
  }

  public static sanitizeHeaders(headers: Record<string, string | undefined>): Record<string, string> {
    return defaultLogSanitizer.sanitizeHeaders(headers);
  }
}

export const defaultLogSanitizer = new LogSanitizer();

