import { describe, it, expect } from 'vitest';
import { AgentProtocolVersion } from '../../../src/agent/adapters/models/AgentProtocolVersion.js';
import { AgentCapabilityMapper } from '../../../src/agent/adapters/core/AgentCapabilityMapper.js';
import type { AdapterMetadata } from '../../../src/agent/adapters/models/AdapterMetadata.js';

describe('Adapter Protocol Version Negotiation Tests', () => {
  const capabilityMapper = new AgentCapabilityMapper();

  const mockMetadata: AdapterMetadata = {
    adapterId: 'versioned_adapter',
    name: 'Versioned Adapter',
    adapterVersion: '2.1.0',
    protocolVersion: '1.2',
    provider: 'GENERIC',
    protocol: 'CANONICAL',
    type: 'REFERENCE',
    status: 'READY',
    capabilities: ['CONTEXT_RETRIEVAL', 'TOOL_CALLING'],
    createdAt: Date.now(),
  };

  it('correctly parses semantic and dot versions', () => {
    const v1 = AgentProtocolVersion.parse('1.2.3');
    expect(v1).toEqual({ major: 1, minor: 2, patch: 3, raw: '1.2.3' });

    const v2 = AgentProtocolVersion.parse('2.0');
    expect(v2).toEqual({ major: 2, minor: 0, patch: 0, raw: '2.0' });

    const invalid = AgentProtocolVersion.parse('invalid');
    expect(invalid).toBeUndefined();
  });

  it('evaluates version compatibility adhering to semver major compatibility', () => {
    expect(AgentProtocolVersion.isCompatible('1.2', '1.0')).toBe(true);
    expect(AgentProtocolVersion.isCompatible('1.2', '1.2')).toBe(true);
    expect(AgentProtocolVersion.isCompatible('1.2', '2.0')).toBe(false);
  });

  it('performs full compatibility assessment with capability mapper', () => {
    const assessment = capabilityMapper.assessCompatibility(mockMetadata, '1.0', [
      'CONTEXT_RETRIEVAL',
    ]);
    expect(assessment.status).toBe('FULL');
    expect(assessment.negotiatedProtocolVersion).toBe('1.0');
    expect(assessment.adapterVersion).toBe('2.1.0');

    const incompatible = capabilityMapper.assessCompatibility(mockMetadata, '3.0');
    expect(incompatible.status).toBe('INCOMPATIBLE');
    expect(incompatible.errors.length).toBeGreaterThan(0);
  });
});
