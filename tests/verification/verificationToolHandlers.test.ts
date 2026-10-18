import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVerificationStore } from '../../src/verification/services/InMemoryVerificationStore.js';
import { VerificationProcessor } from '../../src/verification/services/VerificationProcessor.js';
import { VerificationQueryService } from '../../src/verification/services/VerificationQueryService.js';
import { ProjectMindGetVerificationHandler } from '../../src/verification/handlers/ProjectMindGetVerificationHandler.js';
import { ProjectMindGetVerificationSummaryHandler } from '../../src/verification/handlers/ProjectMindGetVerificationSummaryHandler.js';
import { ProjectMindGetVerificationTimelineHandler } from '../../src/verification/handlers/ProjectMindGetVerificationTimelineHandler.js';
import { ProjectMindGetCompletionEvidenceHandler } from '../../src/verification/handlers/ProjectMindGetCompletionEvidenceHandler.js';
import { ProjectMindGetVerificationConflictsHandler } from '../../src/verification/handlers/ProjectMindGetVerificationConflictsHandler.js';
import { ProjectMindReportVerificationHandler } from '../../src/agent/protocol/handlers/ProjectMindReportVerificationHandler.js';
import type { ToolRequest } from '../../src/agent/protocol/models/ToolRequest.js';

describe('Verification Canonical Tool Handlers', () => {
  let store: InMemoryVerificationStore;
  let processor: VerificationProcessor;
  let queryService: VerificationQueryService;

  let getVerificationHandler: ProjectMindGetVerificationHandler;
  let getSummaryHandler: ProjectMindGetVerificationSummaryHandler;
  let getTimelineHandler: ProjectMindGetVerificationTimelineHandler;
  let getEvidenceHandler: ProjectMindGetCompletionEvidenceHandler;
  let getConflictsHandler: ProjectMindGetVerificationConflictsHandler;
  let reportVerificationHandler: ProjectMindReportVerificationHandler;

  beforeEach(async () => {
    store = new InMemoryVerificationStore();
    processor = new VerificationProcessor({ store });
    queryService = new VerificationQueryService(store);

    getVerificationHandler = new ProjectMindGetVerificationHandler(queryService);
    getSummaryHandler = new ProjectMindGetVerificationSummaryHandler(queryService);
    getTimelineHandler = new ProjectMindGetVerificationTimelineHandler(queryService);
    getEvidenceHandler = new ProjectMindGetCompletionEvidenceHandler(queryService);
    getConflictsHandler = new ProjectMindGetVerificationConflictsHandler(queryService);
    reportVerificationHandler = new ProjectMindReportVerificationHandler(
      undefined,
      undefined,
      undefined,
      processor
    );

    // Populate a verification record
    await processor.processVerification({
      taskId: 'task-tools-1',
      workspaceId: 'workspace-a',
      repositoryId: 'repo-1',
      verificationType: 'TEST',
      passed: true,
      summary: 'API contract test passed',
    });
  });


  function makeRequest(toolName: string, args: Record<string, unknown>): ToolRequest {
    return {
      requestId: 'req-1',
      toolName,
      agentId: 'agent-1',
      arguments: args,
      workspaceId: 'workspace-a',
      repositoryId: 'repo-1',
      protocolVersion: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  it('executes projectmind_get_verification successfully', async () => {
    const res = await getVerificationHandler.execute(
      makeRequest('projectmind_get_verification', { taskId: 'task-tools-1' })
    );

    expect(res['total']).toBe(1);
    expect((res['records'] as unknown[]).length).toBe(1);
  });

  it('executes projectmind_get_verification_summary successfully', async () => {
    const res = await getSummaryHandler.execute(
      makeRequest('projectmind_get_verification_summary', { taskId: 'task-tools-1' })
    );

    expect(res['taskId']).toBe('task-tools-1');
    expect(res['total']).toBe(1);
    expect(res['passed']).toBe(1);
    expect(res['latestStatus']).toBe('PASSED');
  });

  it('executes projectmind_get_verification_timeline successfully', async () => {
    const res = await getTimelineHandler.execute(
      makeRequest('projectmind_get_verification_timeline', { taskId: 'task-tools-1' })
    );

    expect(res['taskId']).toBe('task-tools-1');
    expect(res['totalEntries']).toBe(1);
  });

  it('executes projectmind_get_completion_evidence successfully', async () => {
    const res = await getEvidenceHandler.execute(
      makeRequest('projectmind_get_completion_evidence', { taskId: 'task-tools-1' })
    );

    expect(res['taskId']).toBe('task-tools-1');
    expect(res['status']).toBeDefined();
  });

  it('executes projectmind_get_verification_conflicts successfully', async () => {
    const res = await getConflictsHandler.execute(
      makeRequest('projectmind_get_verification_conflicts', { taskId: 'task-tools-1' })
    );

    expect(res['taskId']).toBe('task-tools-1');
    expect(res['totalConflicts']).toBe(0);
  });

  it('routes projectmind_report_verification through VerificationProcessor', async () => {
    const res = await reportVerificationHandler.execute(
      makeRequest('projectmind_report_verification', {
        taskId: 'task-tools-2',
        passed: true,
        summary: 'Unit test reported by agent',
      })
    );

    expect(res['recorded']).toBe(true);
    expect(res['status']).toBe('PASSED');
    expect(res['provenance']).toBe('AGENT_REPORTED');

    // Confirm it exists in the store
    const stored = await store.listVerifications({ taskId: 'task-tools-2' });
    expect(stored.length).toBe(1);
    expect(stored[0]!.provenance.verificationLevel).toBe('AGENT_REPORTED');
  });
});
