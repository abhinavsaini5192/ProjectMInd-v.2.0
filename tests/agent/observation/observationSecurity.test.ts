import { describe, it, expect } from 'vitest';
import { ObservationSecurityValidator } from '../../../src/agent/observation/security/ObservationSecurityValidator.js';
import { ObservationValidator } from '../../../src/agent/observation/validators/ObservationValidator.js';
import {
  ObservationPayloadLimitError,
  ObservationSecurityError,
  ObservationValidationError,
} from '../../../src/agent/observation/errors/ObservationError.js';
import { createMockObservation } from './ObservationTestHelper.js';

describe('Observation Security & Validation', () => {
  const securityValidator = new ObservationSecurityValidator();
  const validator = new ObservationValidator(securityValidator);

  it('rejects observations exceeding the 64KB payload size limit', () => {
    const hugePayload = {
      output: 'A'.repeat(65 * 1024), // 65KB
    };
    const obs = createMockObservation({ payload: hugePayload });

    expect(() => validator.validateObservation(obs)).toThrow(ObservationPayloadLimitError);
  });

  it('rejects path traversal in affected resources', () => {
    const maliciousObs = createMockObservation({
      affectedResources: ['src/valid.ts', '../../etc/passwd'],
    });

    expect(() => validator.validateObservation(maliciousObs)).toThrow(ObservationSecurityError);
  });

  it('rejects windows-style path traversal in affected resources', () => {
    const maliciousObs = createMockObservation({
      affectedResources: ['..\\..\\Windows\\System32\\cmd.exe'],
    });

    expect(() => validator.validateObservation(maliciousObs)).toThrow(ObservationSecurityError);
  });

  it('redacts secrets from command strings and text payloads', () => {
    const command = 'npm publish --token=npm_abcdef1234567890abcdef1234567890';
    const redacted = securityValidator.sanitizePayload({ command });

    expect(redacted['command']).not.toContain('npm_abcdef1234567890');
    expect(redacted['command']).toContain('[REDACTED_NPM_TOKEN]');
  });

  it('enforces strict "No Hidden Reasoning" policy by stripping reasoning fields', () => {
    const payloadWithReasoning = {
      decision: 'Refactored auth token flow',
      chainOfThought: 'Step 1: Agent planning steps... Step 2: Hidden rationale...',
      internalTokens: [1, 2, 3, 4],
      scratchpad: 'Drafting response',
      cot: 'Another thinking tag',
    };

    const sanitized = securityValidator.sanitizePayload(payloadWithReasoning);
    expect(sanitized['decision']).toBe('Refactored auth token flow');
    expect(sanitized['chainOfThought']).toBeUndefined();
    expect(sanitized['internalTokens']).toBeUndefined();
    expect(sanitized['scratchpad']).toBeUndefined();
    expect(sanitized['cot']).toBeUndefined();
  });

  it('validates workspace and repository scope isolation', () => {
    const obs = createMockObservation({
      workspaceId: 'ws-correct',
      repositoryId: 'repo-correct',
    });

    // Matching scope succeeds
    expect(() => validator.validateScope(obs, 'ws-correct', 'repo-correct')).not.toThrow();

    // Mismatched workspace fails
    expect(() => validator.validateScope(obs, 'ws-other', 'repo-correct')).toThrow(ObservationSecurityError);

    // Mismatched repository fails
    expect(() => validator.validateScope(obs, 'ws-correct', 'repo-other')).toThrow(ObservationSecurityError);
  });
});
