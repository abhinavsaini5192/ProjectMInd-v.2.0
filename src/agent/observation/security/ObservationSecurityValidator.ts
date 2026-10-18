import { SecuritySanitizer } from '../../../intelligence/agent/hardening/SecuritySanitizer.js';
import {
  ObservationPayloadLimitError,
  ObservationSecurityError,
} from '../errors/ObservationError.js';

export interface SecuritySanitizationOptions {
  readonly maxPayloadBytes?: number | undefined;
  readonly maxCommandLength?: number | undefined;
  readonly redactSecrets?: boolean | undefined;
  readonly checkPromptInjection?: boolean | undefined;
}

export class ObservationSecurityValidator {
  private static readonly DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB
  private static readonly DEFAULT_MAX_COMMAND_LENGTH = 2000;

  private static readonly HIDDEN_REASONING_KEYS: readonly string[] = [
    'chainofthought',
    'chain_of_thought',
    'internaltokens',
    'internal_tokens',
    'hiddenprompt',
    'hidden_prompt',
    'scratchpad',
    'internalreasoning',
    'internal_reasoning',
    'cot',
  ];

  /**
   * Validate that payload size does not exceed bounded limit.
   */
  public static validatePayloadSize(
    payload: unknown,
    maxBytes: number = ObservationSecurityValidator.DEFAULT_MAX_PAYLOAD_BYTES
  ): void {
    const serialized = JSON.stringify(payload);
    const byteLength = Buffer.byteLength(serialized, 'utf-8');
    if (byteLength > maxBytes) {
      throw new ObservationPayloadLimitError(
        `Observation payload size (${byteLength} bytes) exceeds limit of ${maxBytes} bytes`,
        byteLength,
        maxBytes
      );
    }
  }

  /**
   * Enforce NO HIDDEN REASONING policy (Section 41).
   * Throws ObservationSecurityError if hidden chain-of-thought or internal tokens are present,
   * or strips them cleanly.
   */
  public static sanitizeHiddenReasoning(obj: Record<string, unknown>, strict: boolean = true): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
      if (ObservationSecurityValidator.HIDDEN_REASONING_KEYS.some((k) => lowerKey.includes(k.replace(/[-_]/g, '')))) {
        if (strict) {
          throw new ObservationSecurityError(
            `Hidden reasoning and model telemetry collection is prohibited (key: '${key}')`,
            'HIDDEN_REASONING_REJECTED'
          );
        }
        continue; // skip
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = this.sanitizeHiddenReasoning(value as Record<string, unknown>, strict);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Rejects path traversal attempts in resource file paths.
   */
  public static sanitizeResourcePath(path: string): string {
    if (!path || typeof path !== 'string') {
      throw new ObservationSecurityError('Resource path must be a non-empty string', 'INVALID_RESOURCE_PATH');
    }

    // Check for path traversal attempts
    if (path.includes('..') || path.includes('../') || path.includes('..\\')) {
      throw new ObservationSecurityError(
        `Path traversal sequence detected in path: '${path}'`,
        'PATH_TRAVERSAL_DETECTED'
      );
    }

    // Normalize forward slashes and strip leading slashes/current-dir prefixes
    let normalized = path.replace(/\\/g, '/');
    if (normalized.startsWith('./')) {
      normalized = normalized.substring(2);
    }
    while (normalized.startsWith('/')) {
      normalized = normalized.substring(1);
    }

    return normalized;
  }

  private static readonly OBSERVATION_SECRET_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
    // NPM tokens
    { regex: /npm_[A-Za-z0-9]+/g, replacement: '[REDACTED_NPM_TOKEN]' },
    // GitHub personal access tokens
    { regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]+/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
    // Slack tokens
    { regex: /xox[baprs]-[A-Za-z0-9-]+/g, replacement: '[REDACTED_SLACK_TOKEN]' },
    // Anthropic API keys
    { regex: /sk-ant-[A-Za-z0-9-_]+/g, replacement: '[REDACTED_API_KEY]' },
    // Generic sk- API keys
    { regex: /sk-[A-Za-z0-9]{20,}/g, replacement: '[REDACTED_API_KEY]' },
  ];

  public static redactSecrets(input: string): string {
    let sanitized = input;
    for (const { regex, replacement } of this.OBSERVATION_SECRET_PATTERNS) {
      sanitized = sanitized.replace(regex, replacement);
    }
    return SecuritySanitizer.redactSecrets(sanitized);
  }

  /**
   * Redacts secrets in command strings and limits length.
   * Ensures command text is treated strictly as descriptive observation, never executable.
   */
  public static sanitizeCommandText(
    command: string,
    maxLength: number = ObservationSecurityValidator.DEFAULT_MAX_COMMAND_LENGTH
  ): string {
    if (!command || typeof command !== 'string') {
      return '';
    }

    let trimmed = command.trim();
    if (trimmed.length > maxLength) {
      trimmed = trimmed.substring(0, maxLength) + '... [TRUNCATED]';
    }

    return ObservationSecurityValidator.redactSecrets(trimmed);
  }

  /**
   * Redacts secrets from free-form text strings (e.g. summaries, descriptions, messages).
   */
  public static sanitizeText(text: string, checkPromptInjection: boolean = false): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    if (checkPromptInjection) {
      SecuritySanitizer.checkPromptInjection(text, false);
    }

    return ObservationSecurityValidator.redactSecrets(text);
  }

  /**
   * Sanitizes arbitrary payload objects:
   * 1. Strips hidden reasoning (chain-of-thought, internal tokens)
   * 2. Redacts secrets from string values
   */
  public static sanitizePayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const withoutReasoning = ObservationSecurityValidator.sanitizeHiddenReasoning(
      payload as Record<string, unknown>,
      false
    );

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(withoutReasoning)) {
      if (typeof value === 'string') {
        result[key] = ObservationSecurityValidator.redactSecrets(value);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = ObservationSecurityValidator.sanitizePayload(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'string'
            ? ObservationSecurityValidator.redactSecrets(item)
            : item && typeof item === 'object'
              ? ObservationSecurityValidator.sanitizePayload(item)
              : item
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  public sanitizePayload(payload: unknown): Record<string, unknown> {
    return ObservationSecurityValidator.sanitizePayload(payload);
  }
}
