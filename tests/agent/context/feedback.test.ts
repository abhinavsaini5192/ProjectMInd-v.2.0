import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';

describe('Context Feedback & Evaluation', () => {
  it('records agent feedback with quality signals and comments', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login timeout',
    });

    const feedback = await harness.sessionManager.recordFeedback({
      contextSessionId: startResult.contextSession.contextSessionId,
      rating: 'PARTIALLY_USEFUL',
      missingFeatures: ['feat-audit-log'],
      missingResources: ['src/auth/AuditLogger.ts'],
      unnecessaryResources: ['src/billing/Invoice.ts'],
      comments: 'Context had login logic but lacked audit logging definitions',
    });

    expect(feedback.feedbackId).toBeDefined();
    expect(feedback.rating).toBe('PARTIALLY_USEFUL');
    expect(feedback.missingFeatures).toContain('feat-audit-log');
    expect(feedback.comments).toBe(
      'Context had login logic but lacked audit logging definitions'
    );

    const storedFeedback = await harness.store.listFeedback(
      startResult.contextSession.contextSessionId
    );
    expect(storedFeedback).toHaveLength(1);
    expect(storedFeedback[0]?.feedbackId).toBe(feedback.feedbackId);

    const events = harness.eventBus.published.map((e) => e.event);
    expect(events).toContain('agent.context.feedback.received');
  });
});
