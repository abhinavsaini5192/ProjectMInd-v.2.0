import { describe, it, expect } from 'vitest';
import { createObservationTestHarness } from './ObservationTestHelper.js';

describe('Observation Query and Timeline Services', () => {
  it('supports filtered and paginated observation queries', async () => {
    const { processor, queryService } = createObservationTestHarness();
    const taskId = 'task-query-1';

    for (let i = 1; i <= 5; i++) {
      await processor.process({
        taskId,
        sessionId: 'session-1',
        workspaceId: 'ws-1',
        repositoryId: 'repo-1',
        source: i % 2 === 0 ? 'SYSTEM' : 'AGENT',
        type: i % 2 === 0 ? 'BUILD_RESULT' : 'COMMAND_EXECUTION',
        summary: `Observation step ${i}`,
        sequenceNumber: i,
        affectedResources: i === 3 ? ['src/special.ts'] : ['src/normal.ts'],
      });
    }

    // Filter by taskId
    const taskQuery = await queryService.getObservations({ taskId, workspaceId: 'ws-1', repositoryId: 'repo-1' });
    expect(taskQuery.totalObservations).toBe(5);

    // Filter by type
    const buildQuery = await queryService.getObservations({ taskId, type: 'BUILD_RESULT', workspaceId: 'ws-1', repositoryId: 'repo-1' });
    expect(buildQuery.totalObservations).toBe(2);

    // Filter by affected resource
    const resQuery = await queryService.getObservations({ taskId, resourcePath: 'src/special.ts', workspaceId: 'ws-1', repositoryId: 'repo-1' });
    expect(resQuery.totalObservations).toBe(1);

    // Pagination (limit 2, offset 1)
    const pageQuery = await queryService.getObservations({ taskId, limit: 2, offset: 1, workspaceId: 'ws-1', repositoryId: 'repo-1' });
    expect(pageQuery.observations.length).toBe(2);
    expect(pageQuery.totalObservations).toBe(5);
    expect(pageQuery.hasMore).toBe(true);
  });

  it('generates a causal timeline for a task', async () => {
    const { processor, queryService } = createObservationTestHarness();
    const taskId = 'task-timeline-1';

    const obs1 = await processor.process({
      taskId,
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'TASK_STARTED',
      summary: 'Task started',
      sequenceNumber: 1,
    });

    const obs2 = await processor.process({
      taskId,
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'COMMAND_EXECUTION',
      summary: 'Ran npm build',
      sequenceNumber: 2,
      parentObservationId: obs1.observation.observationId,
    });

    const timeline = await queryService.getTaskTimeline(taskId);
    expect(timeline.totalObservations).toBe(2);
    expect(timeline.entries.length).toBe(2);

    const secondEntry = timeline.entries[1]!;
    expect(secondEntry.causality).toBe('EXPLICIT');
    expect(secondEntry.parentObservationId).toBe(obs1.observation.observationId);
  });

  it('generates an execution observation summary aggregating task progress, blockers, and verification', async () => {
    const { processor, queryService } = createObservationTestHarness();
    const taskId = 'task-summary-1';

    await processor.process({
      taskId,
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'FILE_MODIFICATION',
      summary: 'Updated AuthService',
      affectedResources: ['src/auth/AuthService.ts'],
    });

    await processor.process({
      taskId,
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'BLOCKER_ENCOUNTERED',
      summary: 'Missing DB credentials',
      payload: { blockerType: 'AUTH_FAILURE', description: 'Cannot connect to DB' },
    });

    await processor.process({
      taskId,
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'VERIFICATION',
      type: 'VERIFICATION_PASSED',
      summary: 'Integration suite passed',
      payload: { passed: true },
    });

    const summary = await queryService.getExecutionSummary(taskId);
    expect(summary.taskId).toBe(taskId);
    expect(summary.totalObservations).toBe(3);
    expect(summary.verificationResult?.passed).toBe(true);
    expect(summary.changedResources).toContain('src/auth/AuthService.ts');
    expect(summary.blockersEncountered?.length).toBe(1);
    expect(summary.blockersEncountered?.[0]?.summary).toBe('Missing DB credentials');
  });
});
