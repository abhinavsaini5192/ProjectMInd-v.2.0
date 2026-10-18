import { describe, it, expect } from 'vitest';
import { PluginManifestValidator } from '../../src/plugins/services/PluginManifestValidator.js';
import { PluginCompatibilityChecker } from '../../src/plugins/services/PluginCompatibilityChecker.js';
import { ManifestValidationError } from '../../src/plugins/errors/PluginError.js';
import crypto from 'crypto';

describe('Phase 9.8 — Plugin Manifest and Compatibility', () => {
  const validator = new PluginManifestValidator();
  const checker = new PluginCompatibilityChecker();

  it('1. should validate a valid plugin manifest', () => {
    const raw = {
      pluginId: 'com.example.git-analyzer',
      name: 'Git Repository Analyzer',
      version: '1.2.0',
      description: 'Analyzes Git commits and branches.',
      publisher: 'acme-corp',
      manifestVersion: '1.0',
      minimumProjectMindVersion: '0.9.0',
      pluginType: 'CONTEXT_PROVIDER',
      entrypoint: 'dist/index.js',
      declaredCapabilities: ['PROVIDE_CONTEXT', 'READ_PROJECT_CONTEXT'],
      requestedPermissions: ['READ:REPOSITORY'],
      dependencies: {
        'com.example.core-utils': '^1.0.0',
      },
    };

    const manifest = validator.validate(raw);
    expect(manifest.pluginId).toBe('com.example.git-analyzer');
    expect(manifest.version).toBe('1.2.0');
    expect(manifest.pluginType).toBe('CONTEXT_PROVIDER');
    expect(manifest.declaredCapabilities).toContain('PROVIDE_CONTEXT');
  });

  it('2. should reject an invalid manifest with missing or malformed fields', () => {
    const invalid = {
      name: 'Missing ID and invalid version',
      version: 'not-a-semver',
    };

    expect(() => validator.validate(invalid)).toThrow(ManifestValidationError);
  });

  it('3. should reject an unsupported manifest version', () => {
    const raw = {
      pluginId: 'future-plugin',
      name: 'Future Plugin',
      version: '1.0.0',
      manifestVersion: '99.0', // Unsupported
    };

    expect(() => validator.validate(raw)).toThrow(/Unsupported manifest version/);
  });

  it('5. should verify a compatible plugin version against ProjectMind core', () => {
    const manifest = validator.validate({
      pluginId: 'compatible-plugin',
      name: 'Compatible Plugin',
      version: '1.0.0',
      minimumProjectMindVersion: '0.9.0',
      maximumCompatibleProjectMindVersion: '1.5.0',
    });

    const result = checker.checkCompatibility(manifest, '0.9.8');
    expect(result.compatible).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('6. should reject an incompatible ProjectMind version when minimum is not met', () => {
    const manifest = validator.validate({
      pluginId: 'bleeding-edge-plugin',
      name: 'Bleeding Edge Plugin',
      version: '2.0.0',
      minimumProjectMindVersion: '1.0.0',
    });

    const result = checker.checkCompatibility(manifest, '0.9.8');
    expect(result.compatible).toBe(false);
    expect(result.issues.some((i) => i.code === 'MIN_VERSION_NOT_MET')).toBe(true);
  });

  it('30. should validate package integrity checksum', () => {
    const content = 'console.log("secure plugin bundle");';
    const checksum = crypto.createHash('sha256').update(content).digest('hex');

    expect(validator.verifyIntegrity(content, checksum)).toBe(true);
    expect(validator.verifyIntegrity(content, 'wrong-hash')).toBe(false);
  });
});
