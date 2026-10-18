import { describe, it, expect } from 'vitest';
import { TokenEstimator } from '../../src/context/budgeting/TokenEstimator.js';
import { ContextBudgetAllocator } from '../../src/context/budgeting/ContextBudgetAllocator.js';
import { ContextCompressionPolicy } from '../../src/context/budgeting/ContextCompressionPolicy.js';
import { TokenBudgetManager } from '../../src/context/budgeting/TokenBudgetManager.js';
import type { SelectedContextData } from '../../src/context/interfaces/IContextSelector.js';
import type { ContextBudget } from '../../src/context/models/ContextBudget.js';

describe('Context Budgeting Subsystem', () => {
  const budgetManager = new TokenBudgetManager();

  const mockSelectedData: SelectedContextData = {
    features: [
      {
        featureId: 'feat-1',
        name: 'Auth',
        description: 'Authentication feature with detailed description that might be compressed.',
        type: 'SERVICE',
        status: 'ACTIVE',
        role: 'DIRECT',
        relevance: { score: 0.9, confidence: 1, importance: 0.9, directness: true, reasons: [] },
        priority: 'CRITICAL',
        resources: [],
        entryPoints: ['Auth.login', 'Auth.logout', 'Auth.refresh'],
        primaryFlows: ['LoginFlow', 'LogoutFlow', 'RefreshFlow'],
        risks: ['Token leak risk'],
        estimatedTokens: 80,
      },
    ],
    resources: [
      {
        resourceId: 'src/auth/AuthService.ts',
        filePath: 'src/auth/AuthService.ts',
        role: 'PRIMARY',
        featureId: 'feat-1',
        relevance: { score: 0.9, confidence: 1, importance: 0.9, directness: true, reasons: [] },
        priority: 'CRITICAL',
        snippet: 'class AuthService { ... }',
        estimatedTokens: 50,
      },
    ],
    behaviorFlows: [{ name: 'LoginFlow' }],
    tests: [{ resourceId: 'tests/auth.test.ts' }],
    risks: [{ description: 'Token risk' }],
    milestones: [{ title: 'Release 1.0' }],
    explanations: { 'feat-1': 'Direct request match' },
  };

  it('estimates tokens accurately using character heuristic', () => {
    expect(TokenEstimator.estimate('')).toBe(0);
    expect(TokenEstimator.estimate('Hello World')).toBe(3); // 11 / 4 rounded up
    expect(TokenEstimator.estimate({ key: 'value' })).toBeGreaterThan(0);
  });

  it('allocates quotas proportional to section weights', () => {
    const allocations = ContextBudgetAllocator.allocate(3200);
    expect(allocations['RESOURCES']).toBeGreaterThan(allocations['IDENTITY']!);
    expect(allocations['BEHAVIOR']).toBeGreaterThan(allocations['HEALTH']!);
  });

  it('compresses features in compact mode', () => {
    const compressed = ContextCompressionPolicy.compress(mockSelectedData);
    expect(compressed.features[0]!.entryPoints.length).toBeLessThanOrEqual(2);
    expect(compressed.resources[0]!.snippet).toBeUndefined();
    expect(Object.keys(compressed.explanations).length).toBe(0);
  });

  it('applies budget and tracks usage, truncation and remaining tokens', () => {
    const budget: ContextBudget = {
      totalBudget: 4000,
      reservedForPrompt: 500,
      reservedForMetadata: 300,
      availableForContext: 3200,
      compactMode: false,
    };

    const result = budgetManager.applyBudget(mockSelectedData, budget);
    expect(result.data.features.length).toBe(1);
    expect(result.allocation.actualUsage['IDENTITY']).toBeGreaterThan(0);
    expect(result.allocation.remainingTokens).toBeGreaterThan(0);
  });

  it('emits TRUNCATED_CONTENT warning when budget is extremely small', () => {
    const tightBudget: ContextBudget = {
      totalBudget: 100,
      reservedForPrompt: 10,
      reservedForMetadata: 10,
      availableForContext: 80,
      compactMode: true,
    };

    // Data with many items
    const largeData: SelectedContextData = {
      ...mockSelectedData,
      resources: Array.from({ length: 30 }, (_, i) => ({
        resourceId: `src/file_${i}.ts`,
        filePath: `src/file_${i}.ts`,
        role: 'SECONDARY',
        featureId: 'feat-1',
        relevance: { score: 0.5, confidence: 1, importance: 0.5, directness: false, reasons: [] },
        priority: 'LOW',
        estimatedTokens: 30,
      })),
    };

    const result = budgetManager.applyBudget(largeData, tightBudget);
    expect(result.warnings.some((w) => w.type === 'TRUNCATED_CONTENT')).toBe(true);
  });
});
