import { describe, it, expect } from 'vitest';
import { createTestOrchestrator, AUTH_FEATURE_ID } from './ContextTestHelper.js';

describe('Context Prompt Composition', () => {
  const orchestrator = createTestOrchestrator();

  it('generates non-empty formattedPrompt and compiledPromptText on package', async () => {
    const res = await orchestrator.orchestrateContext({
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: [AUTH_FEATURE_ID],
      taskText: 'Fix login session timeout issue',
      outputFormat: 'generic-markdown',
    });

    expect(res.formattedPrompt).toBeDefined();
    expect(res.formattedPrompt).toContain('# ProjectMind Context');
    expect(res.formattedPrompt).toContain('--- BEGIN CONTEXT PACKAGE ---');
    expect(res.formattedPrompt).toContain('--- END CONTEXT PACKAGE ---');
    expect(res.package.compiledPromptText).toBe(res.formattedPrompt);
  });

  it('adapts format dynamically to Claude XML when requested', async () => {
    const res = await orchestrator.orchestrateContext({
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: [AUTH_FEATURE_ID],
      outputFormat: 'claude-xml',
    });

    expect(res.formattedPrompt).toContain('<project_mind_context>');
    expect(res.formattedPrompt).toContain('</project_mind_context>');
  });
});
