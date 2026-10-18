import { describe, it, expect } from 'vitest';
import { AgentCapabilityMapper } from '../../../src/agent/adapters/core/AgentCapabilityMapper.js';
import type { AdapterMetadata } from '../../../src/agent/adapters/models/AdapterMetadata.js';

describe('Adapter Capability Degradation Tests', () => {
  const capabilityMapper = new AgentCapabilityMapper();

  const partialMetadata: AdapterMetadata = {
    adapterId: 'minimal_cli_adapter',
    name: 'Minimal CLI Adapter',
    adapterVersion: '1.0.0',
    protocolVersion: '1.0',
    provider: 'GENERIC',
    protocol: 'CLI',
    type: 'CLI',
    status: 'READY',
    capabilities: ['CONTEXT_RETRIEVAL'],
    createdAt: Date.now(),
  };

  it('detects missing capabilities and reports PARTIAL status', () => {
    const result = capabilityMapper.assessCompatibility(partialMetadata, '1.0', [
      'CONTEXT_RETRIEVAL',
      'STREAMING',
      'MCP',
    ]);

    expect(result.status).toBe('PARTIAL');
    expect(result.supportedCapabilities).toEqual(['CONTEXT_RETRIEVAL']);
    expect(result.unsupportedCapabilities).toContain('STREAMING');
    expect(result.unsupportedCapabilities).toContain('MCP');
    expect(result.warnings.length).toBe(2);
  });

  it('identifies exact missing capabilities using getMissingCapabilities', () => {
    const missing = capabilityMapper.getMissingCapabilities(partialMetadata, [
      'CONTEXT_RETRIEVAL',
      'TOOL_CALLING',
      'BATCH_REQUESTS',
    ]);

    expect(missing).toEqual(['TOOL_CALLING', 'BATCH_REQUESTS']);
  });

  it('returns UNSUPPORTED status if zero requested capabilities are supported', () => {
    const result = capabilityMapper.assessCompatibility(partialMetadata, '1.0', [
      'STREAMING',
      'MCP',
    ]);

    expect(result.status).toBe('UNSUPPORTED');
    expect(result.supportedCapabilities).toHaveLength(0);
  });
});
