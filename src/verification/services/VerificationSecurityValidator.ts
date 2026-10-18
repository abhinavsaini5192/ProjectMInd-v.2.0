import { SecuritySanitizer } from '../../intelligence/agent/hardening/SecuritySanitizer.js';
import {
  VerificationPayloadLimitError,
  VerificationSecurityError,
  VerificationTrustError,
} from '../errors/VerificationError.js';

export interface VerificationSecurityOptions {
  readonly maxPayloadBytes?: number | undefined;
  readonly maxDiagnosticsCount?: number | undefined;
  readonly maxSummaryLength?: number | undefined;
}

export class VerificationSecurityValidator {
  public static readonly DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB
  public static readonly DEFAULT_MAX_DIAGNOSTICS_COUNT = 500;
  public static readonly DEFAULT_MAX_SUMMARY_LENGTH = 2000;

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
    maxBytes: number = VerificationSecurityValidator.DEFAULT_MAX_PAYLOAD_BYTES
  ): void {
    const serialized = JSON.stringify(payload);
    const byteLength = Buffer.byteLength(serialized, 'utf-8');
    if (byteLength > maxBytes) {
      throw new VerificationPayloadLimitError(
        `Verification payload size (${byteLength} bytes) exceeds maximum limit of ${maxBytes} bytes`,
        byteLength,
        maxBytes
      );
    }
  }

  /**
   * Rejects path traversal attempts in file paths.
   */
  public static sanitizeResourcePath(path: string): string {
    if (!path || typeof path !== 'string') {
      throw new VerificationSecurityError('Resource path must be a non-empty string');
    }

    if (path.includes('..') || path.includes('../') || path.includes('..\\')) {
      throw new VerificationSecurityError(
        `Path traversal sequence detected in verification path: '${path}'`
      );
    }

    let normalized = path.replace(/\\/g, '/');
    if (normalized.startsWith('./')) {
      normalized = normalized.substring(2);
    }
    while (normalized.startsWith('/')) {
      normalized = normalized.substring(1);
    }

    return normalized;
  }

  private static readonly VERIFICATION_SECRET_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
    // NPM tokens
    { regex: /npm_[A-Za-z0-9]+/g, replacement: '[REDACTED_API_KEY]' },
    // GitHub personal access tokens
    { regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]+/g, replacement: '[REDACTED_API_KEY]' },
    // Slack tokens
    { regex: /xox[baprs]-[A-Za-z0-9-]+/g, replacement: '[REDACTED_API_KEY]' },
    // Anthropic API keys
    { regex: /sk-ant-[A-Za-z0-9-_]+/g, replacement: '[REDACTED_API_KEY]' },
    // Generic sk- API keys
    { regex: /sk-[A-Za-z0-9]{20,}/g, replacement: '[REDACTED_API_KEY]' },
  ];

  /**
   * Redacts secrets from freeform text, summaries, and diagnostics.
   */
  public static sanitizeText(text: string, checkPromptInjection: boolean = false): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    if (checkPromptInjection) {
      SecuritySanitizer.checkPromptInjection(text, false);
    }

    let sanitized = text;
    for (const { regex, replacement } of VerificationSecurityValidator.VERIFICATION_SECRET_PATTERNS) {
      sanitized = sanitized.replace(regex, replacement);
    }

    return SecuritySanitizer.redactSecrets(sanitized);
  }


  /**
   * Sanitizes diagnostic arrays: redacts secrets, bounds total items.
   */
  public static sanitizeDiagnostics(
    diagnostics: readonly string[],
    maxCount: number = VerificationSecurityValidator.DEFAULT_MAX_DIAGNOSTICS_COUNT
  ): string[] {
    if (!Array.isArray(diagnostics)) {
      return [];
    }

    const bounded = diagnostics.slice(0, maxCount);
    return bounded.map((diag) =>
      typeof diag === 'string'
        ? VerificationSecurityValidator.sanitizeText(diag)
        : VerificationSecurityValidator.sanitizeText(JSON.stringify(diag))
    );
  }

  /**
   * Strips hidden reasoning tokens / internal telemetry.
   */
  public static sanitizeHiddenReasoning(
    obj: Record<string, unknown>,
    strict: boolean = true
  ): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
      if (
        VerificationSecurityValidator.HIDDEN_REASONING_KEYS.some((k) =>
          lowerKey.includes(k.replace(/[-_]/g, ''))
        )
      ) {
        if (strict) {
          throw new VerificationSecurityError(
            `Hidden reasoning tokens and telemetry collection is prohibited (key: '${key}')`
          );
        }
        continue;
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = this.sanitizeHiddenReasoning(
          value as Record<string, unknown>,
          strict
        );
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Detects and blocks external attempts to forge trusted provenance.
   * Section 48: Never trust trustLevel, verificationLevel, systemVerified directly from external input.
   */
  public static assertNoForgedProvenance(
    rawInput: Record<string, unknown>,
    authenticatedSource: string
  ): void {
    const forgedKeys = ['systemVerified', 'trusted', 'isTrusted'];
    for (const key of forgedKeys) {
      if (rawInput[key] === true && authenticatedSource === 'AGENT') {
        throw new VerificationTrustError(
          `External agent input attempted to claim trusted verification via '${key}' flag. Trust assignment is restricted to ProjectMind trust registry.`
        );
      }
    }

    if (
      authenticatedSource === 'AGENT' &&
      (rawInput['verificationLevel'] === 'SYSTEM_VERIFIED' ||
        rawInput['trustLevel'] === 'TRUSTED' ||
        rawInput['trustLevel'] === 'AUTHORITATIVE')
    ) {
      throw new VerificationTrustError(
        `External agent input cannot claim verificationLevel='SYSTEM_VERIFIED' or authoritative trustLevel.`
      );
    }
  }
}
