import { describe, it, expect } from 'vitest';
import { AgentProtocolTranslator } from '../../../src/agent/adapters/core/AgentProtocolTranslator.js';
import type { AdapterRequest } from '../../../src/agent/adapters/models/AdapterRequest.js';

describe('Adapter Idempotency & Repeatability Tests', () => {
  const translator = new AgentProtocolTranslator();

  const sampleRequest: AdapterRequest = {
    requestId: 'req_idemp_1',
    adapterId: 'generic_agent_adapter',
    protocol: 'CANONICAL',
    protocolVersion: '1.0',
    operation: 'GET_CONTEXT',
    agentId: 'agent_idemp',
    workspaceContext: {
      workspaceId: 'ws_repeat',
      repositoryId: 'repo_repeat',
    },
    payload: { task: 'Verify repeat logic' },
    timestamp: '2026-09-21T00:00:00.000Z',
  };

  it('produces identical canonical requests when translated repeatedly', () => {
    const result1 = translator.toCanonicalRequest(sampleRequest);
    const result2 = translator.toCanonicalRequest(sampleRequest);

    expect(result1).toEqual(result2);
    expect(result1.requestId).toBe('req_idemp_1');
    expect(result1.operation).toBe('GET_CONTEXT');
  });

  it('does not mutate original adapter request object during translation', () => {
    const cloned = JSON.parse(JSON.stringify(sampleRequest));
    translator.toCanonicalRequest(sampleRequest);
    expect(sampleRequest).toEqual(cloned);
  });
});
