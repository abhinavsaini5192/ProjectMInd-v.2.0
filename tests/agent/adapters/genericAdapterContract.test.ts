import { describe, it, expect, beforeEach } from 'vitest';
import { GenericAgentAdapter } from '../../../src/agent/adapters/generic/GenericAgentAdapter.js';
import type { AgentResponse } from '../../../src/agent/models/AgentResponse.js';

describe('GenericAgentAdapter Contract Tests', () => {
  let adapter: GenericAgentAdapter;

  beforeEach(() => {
    adapter = new GenericAgentAdapter();
  });

  it('conforms to IAgentAdapter identity and metadata requirements', () => {
    expect(adapter.id).toBe('generic_agent_adapter');
    expect(adapter.name).toContain('Generic');
    expect(adapter.status).toBe('UNINITIALIZED');
    expect(adapter.metadata.protocol).toBe('CANONICAL');
    expect(adapter.metadata.provider).toBe('GENERIC');
    expect(adapter.metadata.capabilities.length).toBeGreaterThanOrEqual(15);
    expect(adapter.supportedProtocolVersions).toContain('1.0');
  });

  it('manages lifecycle transitions correctly', async () => {
    expect(adapter.status).toBe('UNINITIALIZED');
    await adapter.initialize();
    expect(adapter.status).toBe('READY');
    await adapter.shutdown();
    expect(adapter.status).toBe('STOPPED');
  });

  it('checks compatibility deterministically', () => {
    const fullCompat = adapter.checkCompatibility('1.0', ['CONTEXT_RETRIEVAL', 'TOOL_CALLING']);
    expect(fullCompat.status).toBe('FULL');
    expect(fullCompat.supportedCapabilities).toContain('CONTEXT_RETRIEVAL');
    expect(fullCompat.supportedCapabilities).toContain('TOOL_CALLING');
    expect(fullCompat.unsupportedCapabilities).toHaveLength(0);

    const versionMismatch = adapter.checkCompatibility('2.0');
    expect(versionMismatch.status).toBe('INCOMPATIBLE');
    expect(versionMismatch.errors.length).toBeGreaterThan(0);
  });

  it('translates generic requests to normalized AdapterRequest', async () => {
    const raw = {
      id: 'req_123',
      operation: 'GET_CONTEXT',
      workspaceId: 'ws_test',
      repositoryId: 'repo_test',
      payload: { prompt: 'Analyze codebase' },
    };

    const translated = await adapter.translateRequest(raw);
    expect(translated.requestId).toBe('req_123');
    expect(translated.adapterId).toBe('generic_agent_adapter');
    expect(translated.protocol).toBe('CANONICAL');
    expect(translated.operation).toBe('GET_CONTEXT');
    expect(translated.workspaceContext.workspaceId).toBe('ws_test');
    expect(translated.workspaceContext.repositoryId).toBe('repo_test');
  });

  it('translates canonical responses to AdapterResponse', async () => {
    const canonical: AgentResponse = {
      requestId: 'req_123',
      status: 'SUCCESS',
      data: { answer: 'All good' },
      metadata: {
        durationMs: 42,
        timestamp: new Date().toISOString(),
        protocolVersion: '1.0',
      },
    };

    const translated = await adapter.translateResponse(canonical);
    expect(translated.requestId).toBe('req_123');
    expect(translated.status).toBe('SUCCESS');
    expect(translated.data).toEqual({ answer: 'All good' });
    expect(translated.metadata.durationMs).toBe(42);
  });

  it('supports legacy adaptRequest and adaptResponse methods', async () => {
    const legacyReq = {
      id: 'legacy_1',
      operation: 'GET_CONTEXT',
      workspaceId: 'ws_legacy',
      repositoryId: 'repo_legacy',
      payload: { text: 'query' },
    };

    const canonicalReq = await adapter.adaptRequest(legacyReq);
    expect(canonicalReq.requestId).toBe('legacy_1');
    expect(canonicalReq.workspaceContext.workspaceId).toBe('ws_legacy');

    const canonicalResp: AgentResponse = {
      requestId: 'legacy_1',
      status: 'SUCCESS',
      data: { result: 'legacy_success' },
      metadata: {
        durationMs: 10,
        timestamp: new Date().toISOString(),
        protocolVersion: '1.0',
      },
    };

    const nativeResp = await adapter.adaptResponse(canonicalResp);
    expect(nativeResp).toEqual({ result: 'legacy_success' });
  });
});
