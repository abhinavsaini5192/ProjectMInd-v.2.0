import { describe, it, expect } from 'vitest';
import { createTestOrchestrator, AUTH_FEATURE_ID, CHECKOUT_FEATURE_ID } from './ContextTestHelper.js';

describe('Context Orchestrator End-to-End Scenarios', () => {
  const orchestrator = createTestOrchestrator();

  it('Scenario 1: Task text "Fix login timeout issue"', async () => {
    const response = await orchestrator.orchestrateContext({
      taskText: 'Fix login timeout issue in authentication service',
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      tokenBudget: 4000,
      outputFormat: 'claude-xml',
      includeDependencies: true,
      includeBehavior: true,
      includeHealth: true,
      explainSelection: true,
    });

    expect(response.success).toBe(true);
    expect(response.package.packageId).toBeDefined();

    // 1. Feature identity resolution
    const targetFeat = response.package.features.find((f) => f.featureId === AUTH_FEATURE_ID);
    expect(targetFeat).toBeDefined();
    expect(targetFeat!.name).toBe('Authentication Service');
    expect(targetFeat!.role).toBe('DIRECT');

    // 2. Dependency traversal
    const depFeat = response.package.features.find((f) => f.featureId === CHECKOUT_FEATURE_ID);
    expect(depFeat).toBeDefined();
    expect(depFeat!.role).toBe('DEPENDENCY');

    // 3. Relevant resources included
    expect(response.package.resources.some((r) => r.filePath === 'src/auth/AuthService.ts')).toBe(true);

    // 4. Model format adaptation (Claude XML)
    expect(response.formattedPrompt).toContain('<project_mind_context>');
    expect(response.formattedPrompt).toContain('<target_features>');
    expect(response.formattedPrompt).toContain('Authentication Service');

    // 5. Explanations generated
    expect(response.explanations).toBeDefined();
    expect(response.explanations!.taskAnalysisSummary).toContain('Fix login timeout issue');

    // 6. Token budget respected
    expect(response.package.estimatedTokens).toBeLessThanOrEqual(4000);
  });

  it('Scenario 2: Changed resource "src/auth/AuthService.ts"', async () => {
    const response = await orchestrator.orchestrateContext({
      changedResources: ['src/auth/AuthService.ts'],
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      tokenBudget: 3000,
      outputFormat: 'generic-markdown',
      includeImpact: true,
    });

    expect(response.success).toBe(true);

    // 1. Direct feature resolved from changed resource
    expect(response.package.features.some((f) => f.featureId === AUTH_FEATURE_ID)).toBe(true);

    // 2. Resource marked as CRITICAL priority
    const changedRes = response.package.resources.find((r) => r.filePath === 'src/auth/AuthService.ts');
    expect(changedRes).toBeDefined();
    expect(changedRes!.priority).toBe('CRITICAL');

    // 3. Impact data packed
    expect(response.package.impact).toBeDefined();

    // 4. Formatted as generic Markdown
    expect(response.formattedPrompt).toContain('# ProjectMind Context');
    expect(response.formattedPrompt).toContain('src/auth/AuthService.ts');
  });
});
