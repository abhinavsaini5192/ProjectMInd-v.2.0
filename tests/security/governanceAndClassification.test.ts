import { describe, it, expect } from 'vitest';
import { DataClassifier } from '../../src/security/governance/DataClassification.js';
import { CredentialLifecycleManager } from '../../src/security/governance/CredentialLifecycle.js';
import { SecurityConfigValidator } from '../../src/security/governance/SecurityConfigValidator.js';

describe('Security Governance - Data Classification & Credential Lifecycle', () => {
  describe('Data Classification & Handling Rules', () => {
    it('classifies data categories according to handling policies', () => {
      expect(DataClassifier.getClassification('CREDENTIALS')).toBe('SECRET');
      expect(DataClassifier.getClassification('AUDIT_RECORDS')).toBe('SENSITIVE');
      expect(DataClassifier.getClassification('CONTEXT')).toBe('CONFIDENTIAL');
      expect(DataClassifier.getClassification('AGENT_IDENTITY')).toBe('INTERNAL');
    });

    it('prohibits logging of SECRET and SENSITIVE data', () => {
      expect(DataClassifier.canLog('SECRET')).toBe(false);
      expect(DataClassifier.canLog('SENSITIVE')).toBe(false);
      expect(DataClassifier.canLog('CONFIDENTIAL')).toBe(true);
      expect(DataClassifier.canLog('INTERNAL')).toBe(true);
      expect(DataClassifier.canLog('PUBLIC')).toBe(true);
      expect(DataClassifier.canLogCategory('CREDENTIALS')).toBe(false);
    });

    it('enforces scope boundary when evaluating exposure safety', () => {
      expect(DataClassifier.isSafeToExpose('SECRET', true)).toBe(false);
      expect(DataClassifier.isSafeToExpose('CONFIDENTIAL', false)).toBe(false);
      expect(DataClassifier.isSafeToExpose('CONFIDENTIAL', true)).toBe(true);
      expect(DataClassifier.isSafeToExpose('PUBLIC', false)).toBe(true);
    });
  });

  describe('Credential Lifecycle Management', () => {
    it('manages credential registration and active state validation', () => {
      const manager = new CredentialLifecycleManager();
      const cred = manager.registerCredential({
        credentialId: 'cred-1',
        name: 'GitHub Deploy Key',
        type: 'SERVICE_TOKEN',
        scope: { workspaceId: 'ws-mind' },
        ttlMs: 60000,
      });

      expect(cred.state).toBe('ACTIVE');
      const val = manager.validateCredential('cred-1');
      expect(val.isValid).toBe(true);
      expect(val.state).toBe('ACTIVE');
    });

    it('detects expired credentials and marks state EXPIRED', () => {
      const manager = new CredentialLifecycleManager();
      manager.registerCredential({
        credentialId: 'cred-exp',
        name: 'Short-lived token',
        type: 'API_KEY',
        scope: { workspaceId: 'ws-mind' },
        ttlMs: -1000, // Already expired in the past
      });

      const val = manager.validateCredential('cred-exp');
      expect(val.isValid).toBe(false);
      expect(val.state).toBe('EXPIRED');
      expect(val.reason).toContain('expired');
    });

    it('blocks revoked and compromised credentials from authentication', () => {
      const manager = new CredentialLifecycleManager();
      manager.registerCredential({
        credentialId: 'cred-rev',
        name: 'Revoked Key',
        type: 'API_KEY',
        scope: { global: true },
      });

      manager.revokeCredential('cred-rev', 'compromised in incident #42');
      const val1 = manager.validateCredential('cred-rev');
      expect(val1.isValid).toBe(false);
      expect(val1.state).toBe('REVOKED');
      expect(val1.reason).toContain('compromised in incident #42');

      manager.registerCredential({
        credentialId: 'cred-comp',
        name: 'Leaked Key',
        type: 'API_KEY',
        scope: { global: true },
      });
      manager.markCompromised('cred-comp', 'leaked on pastebin');
      const val2 = manager.validateCredential('cred-comp');
      expect(val2.isValid).toBe(false);
      expect(val2.state).toBe('COMPROMISED');
    });

    it('supports seamless credential rotation with version increments', () => {
      const manager = new CredentialLifecycleManager();
      const cred = manager.registerCredential({
        credentialId: 'cred-rot',
        name: 'Rotating token',
        type: 'SERVICE_TOKEN',
        scope: { workspaceId: 'ws-1' },
      });
      expect(cred.version).toBe(1);

      const rotated = manager.rotateCredential('cred-rot', 30000);
      expect(rotated.state).toBe('ROTATING');
      expect(rotated.version).toBe(2);

      const val = manager.validateCredential('cred-rot');
      expect(val.isValid).toBe(true); // ROTATING is valid during overlap
    });
  });

  describe('SecurityConfigValidator', () => {
    it('validates production configuration and fails closed on insecure settings', () => {
      const invalidProdConfig = {
        environment: 'production' as const,
        debugMode: true, // Insecure in prod
        allowUnsafeDevDefaults: true, // Insecure in prod
        authMode: 'none' as const, // Insecure in prod
        corsPolicy: {
          allowedOrigins: ['*'],
          allowCredentials: true, // Wildcard origin with credentials
        },
        secretConfiguration: {
          databasePassword: 'sk-plaintext-unredacted-secret-value-12345',
        },
      };

      const result = SecurityConfigValidator.validate(invalidProdConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      expect(result.errors.some((e) => e.includes('debugMode'))).toBe(true);
      expect(result.errors.some((e) => e.includes('allowUnsafeDevDefaults'))).toBe(true);
      expect(result.errors.some((e) => e.includes("authMode cannot be 'none'"))).toBe(true);
      expect(result.errors.some((e) => e.includes('wildcard origin'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('databasePassword'))).toBe(true);
    });

    it('passes clean production configuration', () => {
      const validProdConfig = {
        environment: 'production' as const,
        debugMode: false,
        allowUnsafeDevDefaults: false,
        authMode: 'token' as const,
        corsPolicy: {
          allowedOrigins: ['https://app.projectmind.ai'],
          allowCredentials: true,
        },
        secretConfiguration: {
          databasePasswordRef: 'vault://secrets/db-pass',
        },
      };

      const result = SecurityConfigValidator.validate(validProdConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
