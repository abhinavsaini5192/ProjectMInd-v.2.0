export interface DiscoveredSecret {
  readonly type: string;
  readonly match: string;
  readonly index: number;
}

export interface SecretScanReport {
  readonly containsSecrets: boolean;
  readonly discoveredCount: number;
  readonly secrets: readonly DiscoveredSecret[];
}

export class SecretScanner {
  private static readonly PATTERNS: Array<{ type: string; regex: RegExp }> = [
    { type: 'OPENAI_KEY', regex: /sk-[a-zA-Z0-9_-]{20,}/g },
    { type: 'GITHUB_TOKEN', regex: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
    { type: 'AWS_ACCESS_KEY', regex: /AKIA[0-9A-Z]{16}/g },
    { type: 'PRIVATE_KEY', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
    { type: 'DB_CONNECTION_CREDENTIALS', regex: /(?:postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^\s]+/gi },
    { type: 'BEARER_TOKEN', regex: /Bearer\s+[a-zA-Z0-9-._~+/]+=*/g },
  ];

  public static scan(text: string): SecretScanReport {
    if (!text || typeof text !== 'string') {
      return { containsSecrets: false, discoveredCount: 0, secrets: [] };
    }

    const secrets: DiscoveredSecret[] = [];

    for (const { type, regex } of this.PATTERNS) {
      // Create new RegExp to reset state for global matches
      const re = new RegExp(regex.source, regex.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        secrets.push({
          type,
          match: match[0],
          index: match.index,
        });
      }
    }

    return {
      containsSecrets: secrets.length > 0,
      discoveredCount: secrets.length,
      secrets,
    };
  }

  public static redact(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let result = text;
    for (const { type, regex } of this.PATTERNS) {
      const re = new RegExp(regex.source, regex.flags);
      result = result.replace(re, `[REDACTED_${type}]`);
    }

    return result;
  }

  public static redactObject<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
      if (typeof obj === 'string') {
        return this.redact(obj) as unknown as T;
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactObject(item)) as unknown as T;
    }

    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('privatekey')
      ) {
        output[key] = '[REDACTED_CREDENTIAL]';
      } else if (typeof value === 'string') {
        output[key] = this.redact(value);
      } else if (typeof value === 'object' && value !== null) {
        output[key] = this.redactObject(value);
      } else {
        output[key] = value;
      }
    }

    return output as T;
  }
}
