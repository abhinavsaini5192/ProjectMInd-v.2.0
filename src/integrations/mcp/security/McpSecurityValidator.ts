import { SecuritySanitizer } from '../../../intelligence/agent/hardening/SecuritySanitizer.js';
import { McpConstants } from '../protocol/McpConstants.js';
import { McpError } from '../errors/McpError.js';
import { McpErrorCodes } from '../errors/McpErrorCodes.js';

export class McpSecurityValidator {
  private static readonly SUSPICIOUS_PATH_PATTERNS = [
    /\.\.[/\\]/,
    /\0/,
    /^[/\\]{2,}/,
  ];

  /**
   * Validates that payload serialized byte size does not exceed allowed threshold.
   */
  public static validatePayloadSize(
    payload: unknown,
    maxBytes: number = McpConstants.DEFAULT_MAX_PAYLOAD_BYTES
  ): void {
    if (payload === undefined || payload === null) {
      return;
    }

    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const byteLength = Buffer.byteLength(serialized, 'utf8');

    if (byteLength > maxBytes) {
      throw new McpError(
        `Payload size (${byteLength} bytes) exceeds maximum limit of ${maxBytes} bytes`,
        McpErrorCodes.PAYLOAD_TOO_LARGE,
        { byteLength, maxBytes }
      );
    }
  }

  /**
   * Validates a string path or resource identifier against path traversal attacks.
   */
  public static validatePathSafety(paramValue: string, paramName: string = 'path'): void {
    for (const pattern of this.SUSPICIOUS_PATH_PATTERNS) {
      if (pattern.test(paramValue)) {
        throw new McpError(
          `Security violation: Suspicious path traversal or illegal character detected in parameter '${paramName}'`,
          McpErrorCodes.INVALID_PARAMS,
          { paramName, value: paramValue }
        );
      }
    }
  }

  /**
   * Validates incoming tool call arguments for payload size, path safety, and prompt injection.
   */
  public static validateArguments(
    args: Record<string, unknown> | undefined,
    maxBytes: number = McpConstants.DEFAULT_MAX_PAYLOAD_BYTES
  ): void {
    if (!args) {
      return;
    }

    this.validatePayloadSize(args, maxBytes);
    this.scanValues(args);
  }

  /**
   * Recursively inspects arguments for path traversal and prompt injection attempts.
   */
  private static scanValues(obj: unknown, keyPath: string = ''): void {
    if (typeof obj === 'string') {
      // Path traversal check on path-like or resource-like keys
      const lowerKey = keyPath.toLowerCase();
      if (
        lowerKey.includes('path') ||
        lowerKey.includes('file') ||
        lowerKey.includes('resource') ||
        lowerKey.includes('dir')
      ) {
        this.validatePathSafety(obj, keyPath);
      }

      // Check for prompt injection in free-form query/prompt fields
      if (
        lowerKey.includes('query') ||
        lowerKey.includes('request') ||
        lowerKey.includes('prompt') ||
        lowerKey.includes('message')
      ) {
        SecuritySanitizer.checkPromptInjection(obj, true);
      }
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        this.scanValues(obj[i], `${keyPath}[${i}]`);
      }
    } else if (obj !== null && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const nextPath = keyPath ? `${keyPath}.${key}` : key;
        this.scanValues(value, nextPath);
      }
    }
  }

  /**
   * Redacts sensitive credentials, tokens, and keys from outgoing messages.
   */
  public static sanitizeOutput(output: string): string {
    return SecuritySanitizer.redactSecrets(output);
  }

  /**
   * Delimits untrusted repository data with security XML tags to prevent context poisoning.
   */
  public static wrapRepositoryData(content: string, resourceUri: string): string {
    return SecuritySanitizer.wrapRepositoryData(content, resourceUri);
  }
}
