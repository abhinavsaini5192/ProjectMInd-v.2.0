import { describe, it, expect } from 'vitest';
import { VerificationSourceTrustRegistry } from '../../src/verification/services/VerificationSourceTrustRegistry.js';
import { VerificationNormalizer } from '../../src/verification/services/VerificationNormalizer.js';
import { VerificationSecurityValidator } from '../../src/verification/services/VerificationSecurityValidator.js';
import { VerificationTrustError } from '../../src/verification/errors/VerificationError.js';

describe('Verification Source Trust Registry & Anti-Forging', () => {
  const trustRegistry = new VerificationSourceTrustRegistry();
  const normalizer = new VerificationNormalizer(trustRegistry);

  it('assigns AGENT_REPORTED and SEMI_TRUSTED to agent sources by default', () => {
    const prov = trustRegistry.resolveProvenance('AGENT', 'copilot-agent');
    expect(prov.source).toBe('AGENT');
    expect(prov.reportedBy).toBe('copilot-agent');
    expect(prov.verificationLevel).toBe('AGENT_REPORTED');
    expect(prov.trustLevel).toBe('SEMI_TRUSTED');
  });

  it('assigns SYSTEM_VERIFIED and AUTHORITATIVE to CI source', () => {
    const prov = trustRegistry.resolveProvenance('CI', 'github-actions-ci');
    expect(prov.source).toBe('CI');
    expect(prov.reportedBy).toBe('github-actions-ci');
    expect(prov.verificationLevel).toBe('SYSTEM_VERIFIED');
    expect(prov.trustLevel).toBe('AUTHORITATIVE');
  });

  it('assigns SYSTEM_VERIFIED and TRUSTED to TEST_RUNNER and BUILD_SYSTEM', () => {
    const testProv = trustRegistry.resolveProvenance('TEST_RUNNER', 'vitest-runner');
    expect(testProv.verificationLevel).toBe('SYSTEM_VERIFIED');
    expect(testProv.trustLevel).toBe('TRUSTED');

    const buildProv = trustRegistry.resolveProvenance('BUILD_SYSTEM', 'tsc-compiler');
    expect(buildProv.verificationLevel).toBe('SYSTEM_VERIFIED');
    expect(buildProv.trustLevel).toBe('TRUSTED');
  });

  it('assigns MANUALLY_CONFIRMED and TRUSTED to MANUAL', () => {
    const manualProv = trustRegistry.resolveProvenance('MANUAL', 'tech-lead');
    expect(manualProv.verificationLevel).toBe('MANUALLY_CONFIRMED');
    expect(manualProv.trustLevel).toBe('TRUSTED');
  });

  it('rejects external agent input attempting to forge SYSTEM_VERIFIED via flags', () => {
    expect(() => {
      VerificationSecurityValidator.assertNoForgedProvenance(
        {
          systemVerified: true,
          taskId: 'task-1',
        },
        'AGENT'
      );
    }).toThrow(VerificationTrustError);

    expect(() => {
      VerificationSecurityValidator.assertNoForgedProvenance(
        {
          verificationLevel: 'SYSTEM_VERIFIED',
          taskId: 'task-1',
        },
        'AGENT'
      );
    }).toThrow(VerificationTrustError);

    expect(() => {
      VerificationSecurityValidator.assertNoForgedProvenance(
        {
          isTrusted: true,
          taskId: 'task-1',
        },
        'AGENT'
      );
    }).toThrow(VerificationTrustError);
  });

  it('normalizer preserves AGENT_REPORTED even if agent passes claims in summary or metadata', () => {
    const record = normalizer.normalize({
      taskId: 'task-2',
      source: 'AGENT',
      passed: true,
      summary: 'Tests completely verified by system',
      metadata: { claimedTrust: 'AUTHORITATIVE' },
    });

    expect(record.provenance.verificationLevel).toBe('AGENT_REPORTED');
    expect(record.provenance.trustLevel).toBe('SEMI_TRUSTED');
  });
});
