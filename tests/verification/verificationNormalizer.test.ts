import { describe, it, expect } from 'vitest';
import { VerificationNormalizer } from '../../src/verification/services/VerificationNormalizer.js';

describe('VerificationNormalizer', () => {
  const normalizer = new VerificationNormalizer();

  it('never infers PASSED when source only reports completion', () => {
    const record = normalizer.normalize({
      taskId: 'task-100',
      status: 'COMPLETED', // completion is not PASSED!
      source: 'AGENT',
      summary: 'Command completed execution',
    });

    expect(record.status).toBe('UNKNOWN');
  });

  it('normalizes explicit passed=true and passed=false', () => {
    const passedRecord = normalizer.normalize({
      taskId: 'task-101',
      passed: true,
      source: 'CI',
    });
    expect(passedRecord.status).toBe('PASSED');

    const failedRecord = normalizer.normalize({
      taskId: 'task-102',
      passed: false,
      source: 'CI',
    });
    expect(failedRecord.status).toBe('FAILED');
  });

  it('normalizes status string aliases', () => {
    expect(normalizer.normalize({ status: 'SUCCESS' }).status).toBe('PASSED');
    expect(normalizer.normalize({ status: 'pass' }).status).toBe('PASSED');
    expect(normalizer.normalize({ status: 'FAIL' }).status).toBe('FAILED');
    expect(normalizer.normalize({ status: 'error' }).status).toBe('FAILED');
    expect(normalizer.normalize({ status: 'SKIP' }).status).toBe('SKIPPED');
    expect(normalizer.normalize({ status: 'RUNNING' }).status).toBe('RUNNING');
  });

  it('normalizes resource paths to forward slashes and strips relative prefixes', () => {
    const record = normalizer.normalize({
      taskId: 'task-103',
      passed: true,
      scope: {
        scopeType: 'RESOURCE',
        targetFiles: ['.\\src\\auth\\AuthService.ts', 'src/api/Controller.ts'],
      },
    });

    expect(record.scope.targetFiles).toEqual([
      'src/auth/AuthService.ts',
      'src/api/Controller.ts',
    ]);
  });

  it('strips hidden reasoning keys from metadata', () => {
    const record = normalizer.normalize({
      taskId: 'task-104',
      passed: true,
      metadata: {
        normalKey: 'valid',
        chainOfThought: 'internal model thoughts',
        internalTokens: [1, 2, 3],
      },
    });

    expect(record.metadata['normalKey']).toBe('valid');
    expect(record.metadata['chainOfThought']).toBeUndefined();
    expect(record.metadata['internalTokens']).toBeUndefined();
  });

  it('correctly maps test results in evidence', () => {
    const record = normalizer.normalize({
      taskId: 'task-105',
      verificationType: 'TEST',
      passed: true,
      testResults: [
        { testName: 'loginWithValidCredentials', status: 'PASSED', duration: 45 },
        { testName: 'rejectInvalidToken', status: 'PASSED', duration: 22 },
      ],
    });

    expect(record.evidence.testResults).toBeDefined();
    expect(record.evidence.testResults?.length).toBe(2);
    expect(record.evidence.testResults?.[0]?.testName).toBe('loginWithValidCredentials');
    expect(record.evidence.testResults?.[0]?.status).toBe('PASSED');
  });
});
