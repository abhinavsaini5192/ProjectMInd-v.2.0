import { describe, it, expect } from 'vitest';
import { TokenBudgetManager } from '../../src/context/budgeting/TokenBudgetManager.js';
import { createDefaultRelevance } from '../../src/context/models/ContextRelevance.js';
import { FeatureHealthScorer } from '../../src/knowledge/features/health/core/FeatureHealthScorer.js';
import { HealthSignalHelper } from '../../src/knowledge/features/health/signals/HealthSignalHelper.js';
import { KnowledgeUpdateNormalizer } from '../../src/knowledge/update/core/KnowledgeUpdateNormalizer.js';
import { KnowledgeUpdatePlanner } from '../../src/knowledge/update/core/KnowledgeUpdatePlanner.js';
import type { IKnowledgeImpactResolver } from '../../src/knowledge/update/interfaces/IKnowledgeImpactResolver.js';
import { ResourceLockManager } from '../../src/concurrency/locking/ResourceLockManager.js';
import { InMemoryJobQueue } from '../../src/jobs/queue/InMemoryJobQueue.js';
import type { SelectedContextData } from '../../src/context/interfaces/IContextSelector.js';

describe('Phase 8.10 — Performance & Empirical Latency Verification', () => {
  it('measures context budgeting latency for 100 sample evaluations', () => {
    const budgetManager = new TokenBudgetManager();
    const sampleData: SelectedContextData = {
      features: [
        {
          featureId: 'feat-perf-1',
          name: 'Performance Test Feature',
          description: 'Performance testing feature',
          type: 'BENCHMARK',
          status: 'ACTIVE',
          role: 'DIRECT',
          relevance: createDefaultRelevance(1.0, 1.0, true, ['Benchmark']),
          priority: 'HIGH',
          resources: [],
          entryPoints: [],
          primaryFlows: [],
          risks: [],
          estimatedTokens: 120,
        },
      ],
      resources: Array.from({ length: 20 }, (_, i) => ({
        resourceId: `src/perf/Resource_${i}.ts`,
        featureId: 'feat-perf-1',
        role: 'SOURCE_CODE',
        relevance: createDefaultRelevance(0.95 - i * 0.02, 1.0, true, ['Benchmark resource']),
        priority: 'HIGH' as const,
        estimatedTokens: 80,
      })),
      behaviorFlows: [],
      tests: [],
      risks: [],
      milestones: [],
      explanations: {},
    };

    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      budgetManager.applyBudget(sampleData, {
        totalBudget: 3000,
        reservedForPrompt: 500,
        reservedForMetadata: 300,
        availableForContext: 2200,
        compactMode: false,
      });
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    // Record empirical result
    expect(avgLatencyMs).toBeGreaterThan(0);
    expect(avgLatencyMs).toBeLessThan(50);
  });

  it('measures feature health scoring latency for 100 iterations', () => {
    const scorer = new FeatureHealthScorer();
    const signals = [
      HealthSignalHelper.createSignal({
        featureId: 'feat-perf-health',
        signalType: 'HIGH_CYCLOMATIC_COMPLEXITY',
        severity: 'LOW',
        value: 12,
        normalizedValue: 12,
        description: 'Complexity',
        evidence: [],
        source: 'benchmark',
        confidence: 0.8,
      }),
      HealthSignalHelper.createSignal({
        featureId: 'feat-perf-health',
        signalType: 'DEEP_NESTING',
        severity: 'LOW',
        value: 4,
        normalizedValue: 10,
        description: 'Deep nesting',
        evidence: [],
        source: 'benchmark',
        confidence: 0.9,
      }),
    ];

    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const dimScores = scorer.scoreDimensions(signals);
      scorer.calculateOverallHealth(dimScores);
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    expect(avgLatencyMs).toBeGreaterThan(0);
    expect(avgLatencyMs).toBeLessThan(20);
  });

  it('measures knowledge update normalization and planning latency', async () => {
    const normalizer = new KnowledgeUpdateNormalizer();
    const mockImpactResolver: IKnowledgeImpactResolver = {
      resolveImpact: async () => ({
        directlyAffectedFeatures: ['feat-perf-1'],
        downstreamAffectedFeatures: ['feat-perf-2'],
        affectedKnowledgeAreas: ['FEATURE_MAPPING', 'FEATURE_HEALTH'],
        dependencyPaths: [['feat-perf-1', 'feat-perf-2']],
        confidence: 0.9,
      }),
      resolveBatchImpact: async () => ({
        directlyAffectedFeatures: [],
        downstreamAffectedFeatures: [],
        affectedKnowledgeAreas: [],
        dependencyPaths: [],
        confidence: 1.0,
      }),
    };
    const planner = new KnowledgeUpdatePlanner(mockImpactResolver);

    const iterations = 50;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const update = normalizer.normalize({
        repositoryId: 'repo-bench',
        source: 'EXECUTION_OBSERVATION',
        updateType: 'RESOURCE_CHANGED',
        affectedResources: [`src/bench/File_${i}.ts`],
        agentSessionId: 'sess-bench',
      });
      await planner.plan(update);
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    expect(avgLatencyMs).toBeGreaterThan(0);
    expect(avgLatencyMs).toBeLessThan(50);
  });

  it('measures concurrent resource lock acquisition and release latency', async () => {
    const lockManager = new ResourceLockManager();
    const lockCount = 100;

    const start = performance.now();
    for (let i = 0; i < lockCount; i++) {
      const res = await lockManager.acquire(`resource_bench_${i}`, 'test_bench', { ttlMs: 5000 });
      expect(res.success).toBe(true);
      if (res.lock) {
        await lockManager.release(res.lock.lockId, 'test_bench');
      }
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / lockCount;

    expect(avgLatencyMs).toBeGreaterThan(0);
    expect(avgLatencyMs).toBeLessThan(20);
  });

  it('measures in-memory job queue enqueue throughput', async () => {
    const queue = new InMemoryJobQueue({ maxCapacity: 10000 });
    const jobCount = 500;

    const start = performance.now();
    for (let i = 0; i < jobCount; i++) {
      await queue.enqueue(`job_${i}`, 'NORMAL');
    }
    const elapsed = performance.now() - start;
    const throughputPerSec = (jobCount / elapsed) * 1000;

    const depth = await queue.getDepth();
    expect(depth).toBe(jobCount);
    expect(throughputPerSec).toBeGreaterThan(1000); // Expect > 1k ops/sec in-memory
  });
});
