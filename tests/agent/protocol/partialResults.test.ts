import { describe, it, expect, beforeEach } from 'vitest';
import { createToolPipeline } from '../../../src/agent/protocol/di/ToolDISetup.js';
import type { AgentToolPipeline } from '../../../src/agent/protocol/pipeline/AgentToolPipeline.js';
import {
  createMockToolRequest,
  createMockToolDependencies,
} from './ToolTestHelper.js';

describe('Tool Protocol Partial & Degraded Results Resilience', () => {
  let pipeline: AgentToolPipeline;
  let deps: ReturnType<typeof createMockToolDependencies>;

  beforeEach(() => {
    deps = createMockToolDependencies();
  });

  it('handles empty sections in feature profile gracefully', async () => {
    // Override feature profile to return minimal data
    (deps.featureKnowledgeApi.getFeatureProfile as any) = async () => ({
      featureId: 'feat-empty',
      completeness: { score: 0.2 },
    });

    pipeline = createToolPipeline(deps);

    const request = createMockToolRequest({
      toolName: 'projectmind_get_feature',
      arguments: {
        featureId: 'feat-empty',
      },
    });

    const response = await pipeline.execute(request);
    expect(response.success).toBe(true);
    const result = response.result as Record<string, unknown>;
    expect(result['found']).toBe(true);
    expect(result['feature']).toBeDefined();
  });

  it('handles empty architecture gracefully without throwing null errors', async () => {
    (deps.featureKnowledgeApi.getFeatureArchitecture as any) = async () => null;

    pipeline = createToolPipeline(deps);

    const request = createMockToolRequest({
      toolName: 'projectmind_get_architecture',
      arguments: {
        featureId: 'feat-empty',
      },
    });

    const response = await pipeline.execute(request);
    expect(response.success).toBe(true);
    const result = response.result as Record<string, unknown>;
    expect(result['components']).toEqual([]);
    expect(result['boundaries']).toEqual([]);
  });

  it('handles empty history timeline gracefully', async () => {
    (deps.featureKnowledgeApi.getFeatureHistory as any) = async () => ({
      status: 'AVAILABLE',
      itemCount: 0,
      data: {
        firstSeenAt: 0,
        lastUpdatedAt: 0,
        versionCount: 0,
        maturityLevel: 'EMERGING',
        milestones: [],
        trends: [],
        recentEventsCount: 0,
        regressionsCount: 0,
      },
    });

    pipeline = createToolPipeline(deps);

    const request = createMockToolRequest({
      toolName: 'projectmind_get_history',
      arguments: {
        featureId: 'feat-empty',
      },
    });

    const response = await pipeline.execute(request);
    expect(response.success).toBe(true);
    const result = response.result as Record<string, unknown>;
    expect(result['timeline']).toEqual([]);
    expect(result['totalEvents']).toBe(0);
  });
});
