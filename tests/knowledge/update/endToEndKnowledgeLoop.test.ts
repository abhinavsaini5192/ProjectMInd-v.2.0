import { describe, it, expect, vi } from 'vitest';
import { KnowledgeUpdateCoordinator } from '../../../src/knowledge/update/core/KnowledgeUpdateCoordinator.js';
import { InMemoryKnowledgeUpdateRepository } from '../../../src/knowledge/update/core/InMemoryKnowledgeUpdateRepository.js';
import { KnowledgeUpdateNormalizer } from '../../../src/knowledge/update/core/KnowledgeUpdateNormalizer.js';
import { KnowledgeUpdateDeduplicator } from '../../../src/knowledge/update/core/KnowledgeUpdateDeduplicator.js';
import { KnowledgeUpdateValidator } from '../../../src/knowledge/update/core/KnowledgeUpdateValidator.js';
import { KnowledgeImpactResolver } from '../../../src/knowledge/update/core/KnowledgeImpactResolver.js';
import { KnowledgeUpdatePlanner } from '../../../src/knowledge/update/core/KnowledgeUpdatePlanner.js';
import { KnowledgeUpdateExecutor } from '../../../src/knowledge/update/core/KnowledgeUpdateExecutor.js';
import { KnowledgeVersionManager } from '../../../src/knowledge/update/core/KnowledgeVersionManager.js';
import { KnowledgeInvalidationManager } from '../../../src/knowledge/update/core/KnowledgeInvalidationManager.js';
import { KnowledgeRefreshManager } from '../../../src/knowledge/update/core/KnowledgeRefreshManager.js';
import { KnowledgeUpdateProcessor } from '../../../src/knowledge/update/core/KnowledgeUpdateProcessor.js';
import { KnowledgeUpdateRunManager } from '../../../src/knowledge/update/core/KnowledgeUpdateRunManager.js';
import { KnowledgeUpdateExplainer } from '../../../src/knowledge/update/core/KnowledgeUpdateExplainer.js';
import { ExecutionObservationAdapter } from '../../../src/knowledge/update/adapters/ExecutionObservationAdapter.js';
import { VerificationEvidenceAdapter } from '../../../src/knowledge/update/adapters/VerificationEvidenceAdapter.js';
import type { IFeatureMappingEngine } from '../../../src/knowledge/features/mapping/interfaces/IFeatureMappingEngine.js';
import type { IFeatureDependencyEngine } from '../../../src/knowledge/features/dependencies/interfaces/IFeatureDependencyEngine.js';
import type { IFeatureHealthEngine } from '../../../src/knowledge/features/health/interfaces/IFeatureHealthEngine.js';
import type { IFeatureHistoryEngine } from '../../../src/knowledge/features/history/interfaces/IFeatureHistoryEngine.js';
import type { ExecutionObservation } from '../../../src/agent/observation/models/ExecutionObservation.js';
import type { VerificationRecord } from '../../../src/verification/models/VerificationRecord.js';

describe('End-to-End Knowledge Loop (Section 71)', () => {
  it('closes the loop from Observation -> Evidence -> Update Plan -> Invalidation -> Refresh Decision', async () => {
    const repository = new InMemoryKnowledgeUpdateRepository();
    const normalizer = new KnowledgeUpdateNormalizer();
    const deduplicator = new KnowledgeUpdateDeduplicator(repository);
    const validator = new KnowledgeUpdateValidator();
    const versionManager = new KnowledgeVersionManager(repository);
    const invalidationManager = new KnowledgeInvalidationManager(repository);
    const refreshManager = new KnowledgeRefreshManager({ repository });
    const explainer = new KnowledgeUpdateExplainer();

    const mockMappingEngine: IFeatureMappingEngine = {
      getResourceFeatures: vi.fn().mockResolvedValue(['feat-billing']),
      mapIncremental: vi.fn().mockResolvedValue({} as any),
    } as any;

    const mockDependencyEngine: IFeatureDependencyEngine = {
      getDependents: vi.fn().mockResolvedValue([]),
    } as any;

    const mockHealthEngine: IFeatureHealthEngine = {
      analyzeIncremental: vi.fn().mockResolvedValue({} as any),
    } as any;

    const mockHistoryEngine: IFeatureHistoryEngine = {
      updateIncremental: vi.fn().mockResolvedValue(undefined),
    } as any;

    const impactResolver = new KnowledgeImpactResolver({
      mappingEngine: mockMappingEngine,
      dependencyEngine: mockDependencyEngine,
    });

    const planner = new KnowledgeUpdatePlanner(impactResolver);

    const executor = new KnowledgeUpdateExecutor({
      mappingEngine: mockMappingEngine,
      dependencyEngine: mockDependencyEngine,
      healthEngine: mockHealthEngine,
      historyEngine: mockHistoryEngine,
    });

    const processor = new KnowledgeUpdateProcessor({
      repository,
      executor,
      versionManager,
      invalidationManager,
      refreshManager,
    });

    const runManager = new KnowledgeUpdateRunManager(repository);

    const coordinator = new KnowledgeUpdateCoordinator({
      repository,
      normalizer,
      deduplicator,
      validator,
      planner,
      processor,
      versionManager,
      runManager,
      explainer,
    });

    const obsAdapter = new ExecutionObservationAdapter();
    const verAdapter = new VerificationEvidenceAdapter();

    // Step 1: Agent modifies InvoiceService.ts -> ExecutionObservation event
    const observation: ExecutionObservation = {
      observationId: 'obs-invoice-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-corp',
      taskId: 'task-bill-1',
      agentSessionId: 'sess-bill',
      type: 'FILE_MODIFIED',
      status: 'PROCESSED',
      source: 'TOOL',
      provenance: 'AGENT_REPORTED',
      confidence: 'HIGH',
      summary: 'InvoiceService modified',
      timestamp: new Date().toISOString(),
      observedAt: new Date().toISOString(),
      sequenceNumber: 1,
      orderingStatus: 'ORDERED',
      retention: 'TASK_SCOPED',
      payload: {
        resourcePath: 'src/billing/InvoiceService.ts',
        operation: 'UPDATE',
      } as any,
      metadata: {},
    };

    const obsParams = obsAdapter.toUpdateParams(observation);
    const obsResult = await coordinator.processKnowledgeUpdate(obsParams);

    expect(obsResult.status).toBe('APPLIED');
    expect(obsResult.newKnowledgeVersion).toBeDefined();
    expect(obsResult.affectedFeatures).toContain('feat-billing');

    // Step 2: Verification evidence received from automated tests
    const verificationRecord: VerificationRecord = {
      verificationId: 'v-record-billing',
      workspaceId: 'ws-1',
      repositoryId: 'repo-corp',
      taskId: 'task-bill-1',
      verificationType: 'TEST',
      status: 'PASSED',
      source: 'TEST_RUNNER',
      provenance: {
        source: 'TEST_RUNNER',
        reportedBy: 'CI-Worker',
        receivedAt: new Date().toISOString(),
        observedAt: new Date().toISOString(),
        verificationLevel: 'SYSTEM_VERIFIED',
        trustLevel: 'TRUSTED',
      },
      confidence: 'CONFIRMED',
      repositoryState: { status: 'BOUND', commitId: 'commit-111' },
      scope: {
        scopeType: 'FEATURE',
        targetFiles: ['tests/billing/invoice.test.ts'],
        featureIds: ['feat-billing'],
      },
      receivedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      summary: 'Billing tests passed successfully',
      diagnostics: [],
      evidence: {} as any,
      metadata: {},
    };

    const verParams = verAdapter.toUpdateParams(verificationRecord);
    const verResult = await coordinator.processKnowledgeUpdate(verParams);

    expect(verResult.status).toBe('APPLIED');
    expect(verResult.newKnowledgeVersion).toBeDefined();
    expect(verResult.appliedAreas).toContain('FEATURE_HEALTH');

    // Verify repository audit history
    const allUpdates = await repository.listUpdates('repo-corp');
    expect(allUpdates).toHaveLength(2);

    // Explainer works for both
    const explanation = await coordinator.explainKnowledgeUpdate(obsResult.updateId);
    expect(explanation).toBeDefined();
  });
});
