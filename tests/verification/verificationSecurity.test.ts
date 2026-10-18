import { describe, it, expect } from 'vitest';
import { VerificationSecurityValidator } from '../../src/verification/services/VerificationSecurityValidator.js';
import { VerificationValidator } from '../../src/verification/services/VerificationValidator.js';
import { VerificationNormalizer } from '../../src/verification/services/VerificationNormalizer.js';
import {
  VerificationPayloadLimitError,
  VerificationScopeError,
  VerificationSecurityError,
} from '../../src/verification/errors/VerificationError.js';

describe('Verification Security & Hardening', () => {
  const normalizer = new VerificationNormalizer();
  const validator = new VerificationValidator();

  it('rejects cross-workspace or cross-repository submissions', async () => {
    const record = normalizer.normalize({
      workspaceId: 'workspace-alpha',
      repositoryId: 'repo-one',
      taskId: 'task-sec-1',
      passed: true,
    });

    await expect(
      validator.validate(record, {
        workspaceId: 'workspace-beta', // mismatched tenant!
        repositoryId: 'repo-one',
      })
    ).rejects.toThrow(VerificationScopeError);

    await expect(
      validator.validate(record, {
        workspaceId: 'workspace-alpha',
        repositoryId: 'repo-two', // mismatched repo!
      })
    ).rejects.toThrow(VerificationScopeError);
  });

  it('enforces maximum payload size limit (64KB)', () => {
    const hugeDiagnostics = Array.from({ length: 2000 }, (_, i) => `diagnostic line ${i}: ${'x'.repeat(100)}`);
    const oversizedPayload = {
      taskId: 'task-sec-2',
      diagnostics: hugeDiagnostics,
    };

    expect(() => {
      VerificationSecurityValidator.validatePayloadSize(oversizedPayload, 64 * 1024);
    }).toThrow(VerificationPayloadLimitError);
  });

  it('rejects path traversal attempts in resource file paths', () => {
    expect(() => {
      VerificationSecurityValidator.sanitizeResourcePath('../../../etc/passwd');
    }).toThrow(VerificationSecurityError);

    expect(() => {
      VerificationSecurityValidator.sanitizeResourcePath('..\\..\\windows\\system32\\cmd.exe');
    }).toThrow(VerificationSecurityError);
  });

  it('redacts secrets in summaries and diagnostics', () => {
    const rawText = 'Error connecting to npm with token npm_abc1234567890 and gh token ghp_secretgithubtoken123';
    const sanitized = VerificationSecurityValidator.sanitizeText(rawText);

    expect(sanitized).not.toContain('npm_abc1234567890');
    expect(sanitized).not.toContain('ghp_secretgithubtoken123');
    expect(sanitized).toContain('[REDACTED_API_KEY]');
  });

  it('strips hidden reasoning tokens in strict mode and non-strict mode', () => {
    const hiddenData = {
      status: 'PASSED',
      chainOfThought: 'I am reasoning about testing',
      internalTokens: [100, 200, 300],
    };

    expect(() => {
      VerificationSecurityValidator.sanitizeHiddenReasoning(hiddenData, true);
    }).toThrow(VerificationSecurityError);

    const stripped = VerificationSecurityValidator.sanitizeHiddenReasoning(hiddenData, false);
    expect(stripped['status']).toBe('PASSED');
    expect(stripped['chainOfThought']).toBeUndefined();
    expect(stripped['internalTokens']).toBeUndefined();
  });
});
