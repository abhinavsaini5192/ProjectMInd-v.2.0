import { describe, it, expect } from 'vitest';
import { AgentAdapterManager } from '../../../src/agent/adapters/core/AgentAdapterManager.js';
import type { IAgentAdapter } from '../../../src/agent/adapters/interfaces/IAgentAdapter.js';
import type { AdapterMetadata } from '../../../src/agent/adapters/models/AdapterMetadata.js';

describe('Adapter Failure Isolation Tests', () => {
  it('isolates crashing adapter translations without crashing the host manager', async () => {
    const manager = new AgentAdapterManager();

    const faultyMetadata: AdapterMetadata = {
      adapterId: 'faulty_adapter',
      name: 'Faulty Adapter',
      adapterVersion: '1.0.0',
      protocolVersion: '1.0',
      provider: 'CUSTOM',
      protocol: 'CUSTOM',
      type: 'CUSTOM',
      status: 'READY',
      capabilities: ['CONTEXT_RETRIEVAL'],
      createdAt: Date.now(),
    };

    const faultyAdapter: IAgentAdapter = {
      id: 'faulty_adapter',
      name: 'Faulty Adapter',
      metadata: faultyMetadata,
      status: 'READY',
      supportedProtocolVersions: ['1.0'],
      initialize: async () => {},
      shutdown: async () => {},
      checkCompatibility: () => ({} as any),
      translateRequest: async () => {
        throw new Error('Simulated external provider adapter parsing crash');
      },
      translateResponse: async () => ({} as any),
      adaptRequest: async () => ({} as any),
      adaptResponse: async () => ({} as any),
    };

    await manager.registerAdapter(faultyAdapter);

    // Call processRequest with faulty adapter - should NOT throw uncaught error
    const response = await manager.processRequest(
      { adapterId: 'faulty_adapter' },
      { bad: 'payload' }
    );

    expect(response.status).toBe('ERROR');
    expect(response.error).toBeDefined();
    expect(response.error?.message).toContain('Simulated external provider adapter parsing crash');
    expect(response.error?.severity).toBe('ERROR');
  });

  it('handles adapter shutdown gracefully even when shutdown throws', async () => {
    const manager = new AgentAdapterManager();

    const stubbornAdapter: IAgentAdapter = {
      id: 'stubborn_adapter',
      name: 'Stubborn Adapter',
      metadata: {
        adapterId: 'stubborn_adapter',
        name: 'Stubborn Adapter',
        adapterVersion: '1.0.0',
        protocolVersion: '1.0',
        provider: 'CUSTOM',
        protocol: 'CUSTOM',
        type: 'CUSTOM',
        status: 'READY',
        capabilities: ['CONTEXT_RETRIEVAL'],
        createdAt: Date.now(),
      },
      status: 'READY',
      supportedProtocolVersions: ['1.0'],
      initialize: async () => {},
      shutdown: async () => {
        throw new Error('Failed to close socket');
      },
      checkCompatibility: () => ({} as any),
      translateRequest: async () => ({} as any),
      translateResponse: async () => ({} as any),
      adaptRequest: async () => ({} as any),
      adaptResponse: async () => ({} as any),
    };

    await manager.registerAdapter(stubbornAdapter);
    // Unregistering should not crash
    await expect(manager.unregisterAdapter('stubborn_adapter')).resolves.toBe(true);
  });
});
