import { describe, it, expect, beforeEach } from 'vitest';
import { GenericCliAdapter } from '../../../src/agent/adapters/cli/GenericCliAdapter.js';
import type { AgentResponse } from '../../../src/agent/models/AgentResponse.js';

describe('GenericCliAdapter Unit & Integration Tests', () => {
  let adapter: GenericCliAdapter;

  beforeEach(() => {
    adapter = new GenericCliAdapter();
  });

  it('conforms to CLI agent adapter identity and targetAgentType', () => {
    expect(adapter.id).toBe('cli_agent_adapter');
    expect(adapter.targetAgentType).toBe('CLI_AGENT');
    expect(adapter.metadata.protocol).toBe('CLI');
    expect(adapter.metadata.provider).toBe('GENERIC');
  });

  it('translates raw string prompt into valid AdapterRequest', async () => {
    const rawPrompt = 'Explain the database migrations';
    const req = await adapter.translateRequest(rawPrompt);

    expect(req.operation).toBe('GET_CONTEXT');
    expect((req.payload as any).taskText).toBe('Explain the database migrations');
    expect(req.protocol).toBe('CLI');
  });

  it('translates CLI option payload into AdapterRequest', async () => {
    const cliOptions = {
      prompt: 'Fix payment timeout',
      workspaceId: 'ws_payment',
      repositoryId: 'repo_payment',
      options: { maxTokens: 4000 },
    };

    const req = await adapter.translateRequest(cliOptions);

    expect(req.workspaceContext.workspaceId).toBe('ws_payment');
    expect(req.workspaceContext.repositoryId).toBe('repo_payment');
    expect((req.payload as any).taskText).toBe('Fix payment timeout');
    expect((req.payload as any).maxTokens).toBe(4000);
  });

  it('formats canonical response as human-readable CLI text output', async () => {
    const response: AgentResponse = {
      requestId: 'cli_req_1',
      status: 'SUCCESS',
      data: {
        content: '# Summary\nAll checks passed.',
      },
      metadata: {
        durationMs: 15,
        timestamp: new Date().toISOString(),
        protocolVersion: '1.0',
      },
    };

    const translated = await adapter.translateResponse(response);

    expect(translated.status).toBe('SUCCESS');
    const data = translated.data as any;
    expect(data.text).toBe('# Summary\nAll checks passed.');
  });

  it('formats canonical error responses with [ERROR] prefix', async () => {
    const errorResponse: AgentResponse = {
      requestId: 'cli_err_1',
      status: 'ERROR',
      error: {
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Could not find requested workspace',
      },
      metadata: {
        durationMs: 5,
        timestamp: new Date().toISOString(),
        protocolVersion: '1.0',
      },
    };

    const translated = await adapter.translateResponse(errorResponse);
    expect(translated.status).toBe('ERROR');
    const data = translated.data as any;
    expect(data.text).toContain('[ERROR] WORKSPACE_NOT_FOUND: Could not find requested workspace');
  });
});
