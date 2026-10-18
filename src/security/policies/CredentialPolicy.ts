import { LogRedactor } from '../../platform/logging/LogRedactor.js';

export class CredentialPolicy {
  /**
   * Sanitizes all sensitive strings, tokens, and credentials from a text block.
   */
  public static sanitizeString(input: string): string {
    return LogRedactor.redact(input);
  }

  /**
   * Recursively sanitizes any object or payload before logging or audit persistence.
   */
  public static sanitizeObject<T>(input: T): T {
    return LogRedactor.redactObject(input);
  }

  /**
   * Validates that an API key reference does not expose the raw key value.
   */
  public static maskKey(key: string): string {
    if (key.length <= 8) {
      return '****';
    }
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
}
