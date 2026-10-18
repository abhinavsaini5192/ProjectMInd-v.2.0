export class ConfigRedactor {
  private static readonly SENSITIVE_KEY_PATTERNS = [
    /pass(word)?/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /credential/i,
    /private[_-]?key/i,
    /bearer/i,
  ];

  public static redact(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.redactString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item));
    }

    if (typeof value === 'object') {
      const redactedObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === 'object' && v !== null) {
          // Recurse into nested objects/arrays to redact leaf sensitive keys
          redactedObj[k] = this.redact(v);
        } else if (this.isSensitiveKey(k)) {
          redactedObj[k] = '[REDACTED]';
        } else {
          redactedObj[k] = this.redact(v);
        }
      }
      return redactedObj;
    }

    return value;
  }

  public static isSensitiveKey(key: string): boolean {
    return this.SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
  }

  public static redactString(str: string): string {
    if (!str || typeof str !== 'string') {
      return str;
    }
    return str
      // Redact passwords and credentials in URLs (e.g. redis://user:pass@host, redis://:pass@host, or https://token@host)
      .replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^@\s/]+)@/g, (_match, proto, userinfo) => {
        const colonIdx = userinfo.indexOf(':');
        if (colonIdx >= 0) {
          const user = userinfo.slice(0, colonIdx);
          return `${proto}${user}:[REDACTED]@`;
        }
        return `${proto}[REDACTED]@`;
      })
      .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED]')
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED]')
      .replace(/sk-[0-9A-Za-z]{10,}/g, '[REDACTED]')
      .replace(/sk-ant-[0-9A-Za-z\-_]{20,}/g, '[REDACTED]')
      .replace(/ghp_[0-9A-Za-z]{36}/g, '[REDACTED]')
      .replace(/github_pat_[0-9A-Za-z_]{82}/g, '[REDACTED]')
      .replace(/xox[baprs]-[0-9A-Za-z]{10,48}/g, '[REDACTED]')
      .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED]')
      .replace(/(bearer\s+)[a-zA-Z0-9_.-]+/gi, '$1[REDACTED]');
  }
}
