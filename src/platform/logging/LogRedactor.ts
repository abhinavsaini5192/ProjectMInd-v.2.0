import { ConfigRedactor } from '../config/ConfigRedactor.js';

export class LogRedactor {
  private static readonly SENSITIVE_HEADERS = [
    'authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
  ];

  public static redactEntry<T extends Record<string, unknown>>(entry: T): T {
    return ConfigRedactor.redact(entry) as T;
  }

  public static redactObject<T>(entry: T): T {
    return ConfigRedactor.redact(entry) as T;
  }

  public static redact(content: string): string {
    return ConfigRedactor.redactString(content);
  }

  public static redactString(content: string): string {
    return ConfigRedactor.redactString(content);
  }

  public static redactHeaders(headers: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (this.SENSITIVE_HEADERS.includes(k.toLowerCase())) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = v;
      }
    }
    return result;
  }
}
