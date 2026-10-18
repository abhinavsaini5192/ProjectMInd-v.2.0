import { randomBytes } from 'node:crypto';

export interface ParsedTraceContext {
  readonly version?: string | undefined;
  readonly traceId: string;
  readonly spanId?: string | undefined;
  readonly parentSpanId?: string | undefined;
  readonly sampled: boolean;
  readonly isValid: boolean;
}

export class TraceContext {
  private static readonly TRACE_PARENT_REGEX = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;
  private static readonly ALL_ZEROS_TRACE = '00000000000000000000000000000000';
  private static readonly ALL_ZEROS_SPAN = '0000000000000000';

  /**
   * Generates a 32-character lowercase hex string for W3C traceId.
   */
  public static generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generates a 16-character lowercase hex string for W3C spanId.
   */
  public static generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * Parses and validates a W3C traceparent header value.
   * Returns undefined if header is invalid or malformed per W3C specification.
   */
  public static parseTraceparent(header?: string | undefined): ParsedTraceContext | undefined {
    if (!header || typeof header !== 'string') {
      return undefined;
    }

    const trimmed = header.trim().toLowerCase();
    const match = this.TRACE_PARENT_REGEX.exec(trimmed);

    if (!match) {
      return undefined;
    }

    const [, version, traceId, parentSpanId, traceFlags] = match;

    // Disallow version 'ff' and all zeros per W3C spec
    if (version === 'ff' || traceId === this.ALL_ZEROS_TRACE || parentSpanId === this.ALL_ZEROS_SPAN) {
      return undefined;
    }

    const sampled = (parseInt(traceFlags, 16) & 0x01) === 0x01;

    return {
      version,
      traceId,
      spanId: parentSpanId,
      parentSpanId,
      sampled,
      isValid: true,
    };
  }

  /**
   * Serializes trace context to a W3C traceparent header string.
   */
  public static formatTraceparent(traceId: string, spanId: string, sampled: boolean = true): string {
    const validTraceId = this.normalizeHex(traceId, 32, this.generateTraceId());
    const validSpanId = this.normalizeHex(spanId, 16, this.generateSpanId());
    const flags = sampled ? '01' : '00';
    return `00-${validTraceId}-${validSpanId}-${flags}`;
  }

  /**
   * Alias for formatTraceparent per W3C traceparent conventions.
   */
  public static toTraceparent(traceId: string, spanId: string, sampled: boolean = true): string {
    return this.formatTraceparent(traceId, spanId, sampled);
  }

  /**
   * Validates correlation IDs to ensure they are bounded and contain safe characters.
   */
  public static validateCorrelationId(id: unknown): string | undefined {
    if (typeof id !== 'string') return undefined;
    const trimmed = id.trim();
    if (trimmed.length === 0) return undefined;
    // Safe characters: alphanumeric, hyphens, underscores, dots, colons
    if (!/^[a-zA-Z0-9_\-\.:]+$/.test(trimmed)) return undefined;
    if (trimmed.length > 128) {
      return trimmed.substring(0, 128);
    }
    return trimmed;
  }

  private static normalizeHex(val: string, expectedLength: number, fallback: string): string {
    const cleaned = val.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    if (cleaned.length === expectedLength && cleaned !== '0'.repeat(expectedLength)) {
      return cleaned;
    }
    return fallback;
  }
}
