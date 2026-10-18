import { describe, it, expect } from 'vitest';
import { createObservationTestHarness, createMockObservation } from './ObservationTestHelper.js';

describe('Observation Deduplication', () => {
  it('detects duplicate identical observations and increments deduplication count', async () => {
    const { processor, store } = createObservationTestHarness();

    const raw = {
      taskId: 'task-dedup-1',
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT' as const,
      type: 'COMMAND_EXECUTION' as const,
      summary: 'Run linter',
      payload: { command: 'npm run lint', exitCode: 0 },
      timestamp: '2026-09-20T10:00:00.000Z',
    };

    // First ingestion
    const res1 = await processor.process(raw);
    expect(res1.isDuplicate).toBe(false);
    expect(res1.observation.ordering).toBe('ORDERED');

    // Identical second ingestion
    const res2 = await processor.process(raw);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.observation.ordering).toBe('DUPLICATE');

    // Store should only have 1 active observation stored
    const all = await store.getObservations({ taskId: 'task-dedup-1' });
    expect(all.length).toBe(1);
  });

  it('does not deduplicate observations with distinct payloads or timestamps', async () => {
    const { processor, store } = createObservationTestHarness();

    await processor.process({
      taskId: 'task-dedup-2',
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'COMMAND_EXECUTION',
      summary: 'Run tests 1',
      payload: { command: 'npm test', exitCode: 0 },
      timestamp: '2026-09-20T10:00:00.000Z',
    });

    await processor.process({
      taskId: 'task-dedup-2',
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'COMMAND_EXECUTION',
      summary: 'Run tests 2',
      payload: { command: 'npm test', exitCode: 1 },
      timestamp: '2026-09-20T10:01:00.000Z',
    });

    const all = await store.getObservations({ taskId: 'task-dedup-2' });
    expect(all.length).toBe(2);
  });
});
