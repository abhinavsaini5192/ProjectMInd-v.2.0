import { describe, it, expect } from 'vitest';
import { VerificationNormalizer } from '../../src/verification/services/VerificationNormalizer.js';
import { VerificationValidator } from '../../src/verification/services/VerificationValidator.js';
import type { VerificationScopeType } from '../../src/verification/models/VerificationScope.js';

describe('Verification Scope Handling', () => {
  const normalizer = new VerificationNormalizer();
  const validator = new VerificationValidator();

  const SCOPES: VerificationScopeType[] = [
    'TASK',
    'FEATURE',
    'RESOURCE',
    'FILE',
    'SYMBOL',
    'MODULE',
    'REPOSITORY',
    'WORKSPACE',
  ];

  it('correctly parses and normalizes each canonical scope type', () => {
    for (const s of SCOPES) {
      const record = normalizer.normalize({
        taskId: 'task-scope-test',
        scope: {
          scopeType: s,
          targetIds: ['id-1'],
          targetFiles: ['src/index.ts'],
        },
      });

      expect(record.scope.scopeType).toBe(s);
      expect(record.scope.targetFiles).toContain('src/index.ts');
    }
  });

  it('validates records with valid scopes successfully', async () => {
    const record = normalizer.normalize({
      taskId: 'task-symbol',
      passed: true,
      scope: {
        scopeType: 'SYMBOL',
        symbolNames: ['AuthService.login'],
        targetFiles: ['src/auth/AuthService.ts'],
      },
    });

    const valResult = await validator.validate(record);
    expect(valResult.isValid).toBe(true);
    expect(record.scope.symbolNames).toContain('AuthService.login');
  });

  it('defaults scope to TASK when taskId is present and scope is unspecified', () => {
    const record = normalizer.normalize({
      taskId: 'task-default',
      passed: true,
    });

    expect(record.scope.scopeType).toBe('TASK');
    expect(record.scope.targetIds).toContain('task-default');
  });
});
