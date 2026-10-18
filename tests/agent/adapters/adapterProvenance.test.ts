import { describe, it, expect } from 'vitest';
import { AgentProtocolTranslator } from '../../../src/agent/adapters/core/AgentProtocolTranslator.js';
import type { AdapterRequest } from '../../../src/agent/adapters/models/AdapterRequest.js';
import type { AgentResponse } from '../../../src/agent/models/AgentResponse.js';

describe('Adapter Provenance & Traceability Tests', () => {
  const translator = new AgentProtocolTranslator();

  it('preserves traceId, adapterId, and provider session across translations', () => {
    const originalRequest: AdapterRequest = {
      requestId: 'req_trace_123',
      providerRequestId: 'claude_msg_999',
      adapterId: 'claude_adapter',
      protocol: 'CLI',
      protocolVersion: '1.0',
      operation: 'GET_CONTEXT',
      agentId: 'claude_agent_1',
      sessionId: 'canon_sess_1',
      providerSessionId: 'claude_cli_sess_1',
      workspaceContext: {
        workspaceId: 'ws_prod',
        repositoryId: 'repo_prod',
      },
      payload: { prompt: 'Test' },
      timestamp: '2026-09-21T00:00:00.000Z',
      traceId: 'trace_abc_789',
    };

    const canonicalReq = translator.toCanonicalRequest(originalRequest);
    expect(canonicalReq.traceId).toBe('trace_abc_789');
    expect(canonicalReq.requestId).toBe('req_trace_123');
    expect(canonicalReq.workspaceContext.workspaceId).toBe('ws_prod');

    const canonicalResp: AgentResponse = {
      requestId: 'req_trace_123',
      status: 'SUCCESS',
      data: { answer: 'ok' },
      metadata: {
        durationMs: 45,
        timestamp: '2026-09-21T00:00:01.000Z',
        protocolVersion: '1.0',
        traceId: 'trace_abc_789',
        tokensUsed: 150,
      },
    };

    const adapterResp = translator.fromCanonicalResponse(canonicalResp, originalRequest);
    expect(adapterResp.requestId).toBe('req_trace_123');
    expect(adapterResp.adapterId).toBe('claude_adapter');
    expect(adapterResp.metadata.traceId).toBe('trace_abc_789');
    expect(adapterResp.metadata.tokensUsed).toBe(150);
  });
});
