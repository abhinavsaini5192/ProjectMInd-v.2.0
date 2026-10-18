import { describe, it, expect } from 'vitest';
import { ExecutionObservationAdapter } from '../../../src/knowledge/update/adapters/ExecutionObservationAdapter.js';
import type { ExecutionObservation } from '../../../src/agent/observation/models/ExecutionObservation.js';

describe('ExecutionObservationAdapter', () => {
  const adapter = new ExecutionObservationAdapter();

  it('translates FILE_MODIFIED observation into RESOURCE_CHANGED update parameters', () => {
    const observation: ExecutionObservation = {
      observationId: 'obs-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      taskId: 'task-42',
      agentSessionId: 'sess-1',
      source: 'AGENT',
      type: 'FILE_MODIFIED',
      status: 'PROCESSED',
      timestamp: '2026-09-20T20:00:00Z',
      payload: { filePath: 'src/auth/AuthService.ts' },
      confidence: 'HIGH',
      provenance: 'AGENT_REPORTED',
      orderingStatus: 'ORDERED',
      retention: 'TASK_SCOPED',
      metadata: {},
    };

    const params = adapter.toUpdateParams(observation);

    expect(params.sourceEventId).toBe('obs-1');
    expect(params.repositoryId).toBe('repo-1');
    expect(params.source).toBe('EXECUTION_OBSERVATION');
    expect(params.updateType).toBe('RESOURCE_CHANGED');
    expect(params.provenance).toBe('AGENT_REPORTED');
    expect(params.affectedResources).toContain('src/auth/AuthService.ts');
    expect(params.evidenceReferences).toHaveLength(1);
    expect(params.evidenceReferences![0]?.referenceType).toBe('OBSERVATION');
  });

  it('translates SYMBOL_MODIFIED into SYMBOL_CHANGED update parameters', () => {
    const observation: ExecutionObservation = {
      observationId: 'obs-2',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'TOOL',
      type: 'SYMBOL_MODIFIED',
      status: 'PROCESSED',
      timestamp: '2026-09-20T20:01:00Z',
      payload: { symbol: 'AuthService.login' },
      confidence: 'HIGH',
      provenance: 'SYSTEM_OBSERVED',
      orderingStatus: 'ORDERED',
      retention: 'TASK_SCOPED',
      metadata: {},
    };

    const params = adapter.toUpdateParams(observation);
    expect(params.updateType).toBe('SYMBOL_CHANGED');
    expect(params.provenance).toBe('SYSTEM_OBSERVED');
    expect(params.affectedResources).toContain('AuthService.login');
  });
});
