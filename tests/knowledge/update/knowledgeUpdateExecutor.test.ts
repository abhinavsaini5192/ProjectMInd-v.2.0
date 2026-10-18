import { describe, it, expect, vi } from 'vitest';
import { KnowledgeUpdateExecutor } from '../../../src/knowledge/update/core/KnowledgeUpdateExecutor.js';
import { KnowledgeUpdateNormalizer } from '../../../src/knowledge/update/core/KnowledgeUpdateNormalizer.js';
import type { KnowledgeUpdatePlan } from '../../../src/knowledge/update/models/KnowledgeUpdatePlan.js';

describe('KnowledgeUpdateExecutor', () => {
  const normalizer = new KnowledgeUpdateNormalizer();

  it('executes planned operations incrementally across feature intelligence engines', async () => {
    const mockMappingEngine = { mapIncremental: vi.fn().mockResolvedValue({}) };
    const mockDependencyEngine = { updateIncremental: vi.fn().mockResolvedValue({}) };
    const mockBehaviorEngine = { analyzeIncremental: vi.fn().mockResolvedValue({}) };
    const mockHealthEngine = { analyzeIncremental: vi.fn().mockResolvedValue({}) };
    const mockImpactEngine = { analyzeIncremental: vi.fn().mockResolvedValue({}) };
    const mockHistoryEngine = { updateIncremental: vi.fn().mockResolvedValue({}) };

    const executor = new KnowledgeUpdateExecutor({
      mappingEngine: mockMappingEngine as any,
      dependencyEngine: mockDependencyEngine as any,
      behaviorEngine: mockBehaviorEngine as any,
      healthEngine: mockHealthEngine as any,
      impactEngine: mockImpactEngine as any,
      historyEngine: mockHistoryEngine as any,
    });

    const update = normalizer.normalize({
      repositoryId: 'repo-1',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: ['src/auth/AuthService.ts'],
      affectedFeatures: ['feat-auth'],
    });

    const plan: KnowledgeUpdatePlan = {
      planId: 'plan-1',
      updateId: update.updateId,
      targetResources: ['src/auth/AuthService.ts'],
      targetFeatures: ['feat-auth'],
      targetKnowledgeAreas: [
        'FEATURE_MAPPING',
        'FEATURE_DEPENDENCIES',
        'FEATURE_BEHAVIOR',
        'FEATURE_HEALTH',
        'FEATURE_IMPACT',
        'FEATURE_HISTORY',
      ],
      operations: [],
      invalidationTargets: [],
      refreshTargets: [],
      confidence: 0.9,
      warnings: [],
      conflicts: [],
      skippedAreas: [],
      reasonCodes: [],
      createdAt: Date.now(),
    };

    const result = await executor.executePlan(update, plan);

    expect(mockMappingEngine.mapIncremental).toHaveBeenCalledWith(['src/auth/AuthService.ts']);
    expect(mockDependencyEngine.updateIncremental).toHaveBeenCalledWith(['src/auth/AuthService.ts']);
    expect(mockBehaviorEngine.analyzeIncremental).toHaveBeenCalled();
    expect(mockHealthEngine.analyzeIncremental).toHaveBeenCalledWith(['feat-auth']);
    expect(mockImpactEngine.analyzeIncremental).toHaveBeenCalled();
    expect(mockHistoryEngine.updateIncremental).toHaveBeenCalled();

    expect(result.appliedAreas).toContain('FEATURE_MAPPING');
    expect(result.appliedAreas).toContain('FEATURE_HEALTH');
    expect(result.failedAreas).toHaveLength(0);
  });

  it('isolates failures in individual engines without aborting the execution pipeline', async () => {
    const mockMappingEngine = { mapIncremental: vi.fn().mockResolvedValue({}) };
    const mockBehaviorEngine = {
      analyzeIncremental: vi.fn().mockRejectedValue(new Error('Syntax error in behavior AST')),
    };

    const executor = new KnowledgeUpdateExecutor({
      mappingEngine: mockMappingEngine as any,
      behaviorEngine: mockBehaviorEngine as any,
    });

    const update = normalizer.normalize({
      repositoryId: 'repo-1',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: ['src/auth/AuthService.ts'],
      affectedFeatures: ['feat-auth'],
    });

    const plan: KnowledgeUpdatePlan = {
      planId: 'plan-2',
      updateId: update.updateId,
      targetResources: ['src/auth/AuthService.ts'],
      targetFeatures: ['feat-auth'],
      targetKnowledgeAreas: ['FEATURE_MAPPING', 'FEATURE_BEHAVIOR'],
      operations: [],
      invalidationTargets: [],
      refreshTargets: [],
      confidence: 0.9,
      warnings: [],
      conflicts: [],
      skippedAreas: [],
      reasonCodes: [],
      createdAt: Date.now(),
    };

    const result = await executor.executePlan(update, plan);

    expect(result.appliedAreas).toContain('FEATURE_MAPPING');
    expect(result.failedAreas).toContain('FEATURE_BEHAVIOR');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('FeatureBehavior update failed');
  });
});
