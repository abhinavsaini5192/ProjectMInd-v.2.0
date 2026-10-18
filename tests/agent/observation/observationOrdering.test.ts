import { describe, it, expect } from 'vitest';
import { createObservationTestHarness } from './ObservationTestHelper.js';

describe('Observation Ordering & Sequence Gaps (Section 59)', () => {
  it('detects out-of-order arrivals and reconstructs chronological timeline', async () => {
    const { processor, queryService } = createObservationTestHarness();
    const taskId = 'task-out-of-order-1';

    const t0 = '2026-09-20T10:00:00.000Z';
    const t1 = '2026-09-20T10:05:00.000Z';
    const t2 = '2026-09-20T10:10:00.000Z';

    // 1. Arrive sequence 1 (T0)
    const res1 = await processor.process({
      taskId,
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'TASK_STARTED',
      summary: 'Task started',
      sequenceNumber: 1,
      timestamp: t0,
    });
    expect(res1.observation.ordering).toBe('ORDERED');

    // 2. Arrive sequence 3 (T2) ahead of sequence 2!
    const res3 = await processor.process({
      taskId,
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'BUILD_RESULT',
      summary: 'Build succeeded',
      sequenceNumber: 3,
      timestamp: t2,
    });

    // 3. Arrive sequence 2 (T1) late!
    const res2 = await processor.process({
      taskId,
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'FILE_MODIFICATION',
      summary: 'Modified AuthService.ts',
      sequenceNumber: 2,
      timestamp: t1,
    });
    expect(res2.observation.ordering).toBe('OUT_OF_ORDER');

    // 4. Query timeline: timeline must correctly assemble observations chronologically
    const timeline = await queryService.getTaskTimeline(taskId);
    expect(timeline.totalObservations).toBe(3);
    expect(timeline.entries[0]?.observationId).toBe(res1.observation.observationId);
    expect(timeline.entries[1]?.observationId).toBe(res2.observation.observationId);
    expect(timeline.entries[2]?.observationId).toBe(res3.observation.observationId);

    // Verify chronological timestamps
    expect(timeline.entries[0]?.timestamp).toBe(t0);
    expect(timeline.entries[1]?.timestamp).toBe(t1);
    expect(timeline.entries[2]?.timestamp).toBe(t2);
  });
});
