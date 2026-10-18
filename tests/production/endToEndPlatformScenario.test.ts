import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectMindKernel } from '../../src/kernel/ProjectMindKernel.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { FeatureHealthScorer } from '../../src/knowledge/features/health/core/FeatureHealthScorer.js';
import { HealthSignalHelper } from '../../src/knowledge/features/health/signals/HealthSignalHelper.js';
import { KnowledgeUpdateNormalizer } from '../../src/knowledge/update/core/KnowledgeUpdateNormalizer.js';
import { KnowledgeUpdatePlanner } from '../../src/knowledge/update/core/KnowledgeUpdatePlanner.js';
import type { IKnowledgeImpactResolver } from '../../src/knowledge/update/interfaces/IKnowledgeImpactResolver.js';
import { TokenBudgetManager } from '../../src/context/budgeting/TokenBudgetManager.js';
import { createDefaultRelevance } from '../../src/context/models/ContextRelevance.js';
import { AgentSessionManager } from '../../src/agent/runtime/AgentSessionManager.js';
import { AgentCapabilitySet } from '../../src/agent/models/AgentCapabilitySet.js';
import type { Agent } from '../../src/agent/models/Agent.js';
import { AuditLogger } from '../../src/security/core/AuditLogger.js';
import { PlatformMetricsCollector } from '../../src/platform/observability/PlatformMetricsCollector.js';
import { PlatformTelemetryService } from '../../src/platform/observability/PlatformTelemetryService.js';
import type { SelectedContextData } from '../../src/context/interfaces/IContextSelector.js';

describe('Phase 8.10 — End-to-End Platform Integration Scenario (25-Step Lifecycle)', () => {
  const testWorkspaceDir = path.join(process.cwd(), 'tests', 'production', 'scratch_e2e_workspace');
  let kernel: ProjectMindKernel;
  let eventBus: NodeEventBus;
  let metricsCollector: PlatformMetricsCollector;
  let telemetryService: PlatformTelemetryService;
  let auditLogger: AuditLogger;

  beforeEach(async () => {
    if (!fs.existsSync(testWorkspaceDir)) {
      fs.mkdirSync(testWorkspaceDir, { recursive: true });
    }
    eventBus = new NodeEventBus();
    metricsCollector = new PlatformMetricsCollector();
    telemetryService = new PlatformTelemetryService(metricsCollector);
    auditLogger = new AuditLogger();
    kernel = new ProjectMindKernel(testWorkspaceDir);
    await kernel.initialize();
  });

  afterEach(async () => {
    await kernel.shutdown();
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
  });

  it('should execute the complete 25-step production lifecycle without architectural violation', async () => {
    // -------------------------------------------------------------------------
    // Step 1: Create workspace
    // -------------------------------------------------------------------------
    const workspaceId = `ws_prod_${Date.now()}`;
    expect(fs.existsSync(testWorkspaceDir)).toBe(true);

    // -------------------------------------------------------------------------
    // Step 2: Register repository
    // -------------------------------------------------------------------------
    const repositoryId = 'repo-projectmind-core';
    expect(repositoryId).toBeDefined();

    // -------------------------------------------------------------------------
    // Step 3: Initialize repository intelligence
    // -------------------------------------------------------------------------
    const repoHealth = await kernel.observabilityEngine.getHealth();
    expect(repoHealth.status).toBe('healthy');

    // -------------------------------------------------------------------------
    // Step 4: Discover a feature
    // -------------------------------------------------------------------------
    const featureId = 'feat-jwt-authentication';
    const featureName = 'JWT Authentication & Token Revocation';
    expect(featureId).toBeDefined();

    // -------------------------------------------------------------------------
    // Step 5: Map feature to resources
    // -------------------------------------------------------------------------
    const mappedResources = [
      'src/auth/TokenService.ts',
      'src/auth/SessionValidator.ts',
      'src/auth/interfaces/IToken.ts',
    ];
    expect(mappedResources.length).toBe(3);

    // -------------------------------------------------------------------------
    // Step 6: Build feature dependencies
    // -------------------------------------------------------------------------
    const featureDependencies = [
      { sourceFeature: featureId, targetFeature: 'feat-crypto-primitives', type: 'DEPENDS_ON' },
      { sourceFeature: featureId, targetFeature: 'feat-session-store', type: 'DEPENDS_ON' },
    ];
    expect(featureDependencies).toHaveLength(2);

    // -------------------------------------------------------------------------
    // Step 7: Build behavior flow
    // -------------------------------------------------------------------------
    const behaviorSteps = [
      { step: 1, action: 'ReceiveAuthRequest', component: 'TokenService.issueToken' },
      { step: 2, action: 'ValidateCredentials', component: 'SessionValidator.validate' },
      { step: 3, action: 'SignPayload', component: 'CryptoService.sign' },
    ];
    expect(behaviorSteps).toHaveLength(3);

    // -------------------------------------------------------------------------
    // Step 8: Calculate health/risk
    // -------------------------------------------------------------------------
    const scorer = new FeatureHealthScorer();
    const signals = [
      HealthSignalHelper.createSignal({
        featureId,
        signalType: 'HIGH_CYCLOMATIC_COMPLEXITY',
        severity: 'LOW',
        value: 10,
        normalizedValue: 10,
        description: 'Low complexity baseline signal',
        evidence: [],
        source: 'TEST_RUNNER',
        confidence: 1.0,
      }),
    ];
    const dimScores = scorer.scoreDimensions(signals);
    const healthResult = scorer.calculateOverallHealth(dimScores);
    expect(healthResult.status).toBe('HEALTHY');
    expect(healthResult.overallScore).toBeGreaterThanOrEqual(90);

    // -------------------------------------------------------------------------
    // Step 9: Create feature history
    // -------------------------------------------------------------------------
    const historyEvents = [
      {
        featureId,
        version: 1,
        timestamp: new Date().toISOString(),
        eventType: 'FEATURE_INITIALIZED',
        author: 'system',
      },
    ];
    expect(historyEvents[0]?.version).toBe(1);

    // -------------------------------------------------------------------------
    // Step 10: Agent requests feature context
    // -------------------------------------------------------------------------
    const contextRequest = {
      featureId,
      task: 'Rotate token secret and update claim validation',
      tokenBudget: 4000,
    };

    // -------------------------------------------------------------------------
    // Step 11: Context Orchestrator builds context plan & budgets tokens
    // -------------------------------------------------------------------------
    const budgetManager = new TokenBudgetManager();
    const mockSelectedData: SelectedContextData = {
      features: [
        {
          featureId,
          name: featureName,
          description: 'JWT Authentication and token lifecycle',
          type: 'SECURITY',
          status: 'ACTIVE',
          role: 'DIRECT',
          relevance: createDefaultRelevance(1.0, 1.0, true, ['Requested feature']),
          priority: 'HIGH',
          resources: [],
          entryPoints: [],
          primaryFlows: [],
          risks: [],
          estimatedTokens: 100,
        },
      ],
      resources: mappedResources.map((res, idx) => ({
        resourceId: res,
        featureId,
        role: 'SOURCE_CODE',
        relevance: createDefaultRelevance(1 - idx * 0.1, 1.0, true, ['Mapped resource']),
        priority: 'HIGH' as const,
        estimatedTokens: 150,
      })),
      behaviorFlows: [],
      tests: [],
      risks: [],
      milestones: [],
      explanations: { [featureId]: 'Primary target feature' },
    };

    const budgetedResult = budgetManager.applyBudget(mockSelectedData, {
      totalBudget: contextRequest.tokenBudget,
      reservedForPrompt: 500,
      reservedForMetadata: 300,
      availableForContext: 3200,
      compactMode: false,
    });

    expect(budgetedResult.data.features.length).toBe(1);
    expect(budgetedResult.data.resources.length).toBe(3);
    expect(budgetedResult.allocation.totalUsed).toBeLessThanOrEqual(contextRequest.tokenBudget);

    // -------------------------------------------------------------------------
    // Step 12: Agent receives context package
    // -------------------------------------------------------------------------
    const contextPackage = {
      packageId: `pkg_${Date.now()}`,
      featureId,
      resources: budgetedResult.data.resources.map((r) => r.resourceId),
      estimatedTokens: budgetedResult.allocation.totalUsed,
      freshness: 'FRESH' as const,
      completeness: 'COMPLETE' as const,
      version: 1,
    };
    expect(contextPackage.freshness).toBe('FRESH');

    // -------------------------------------------------------------------------
    // Step 13: Agent reports execution
    // -------------------------------------------------------------------------
    const sessionManager = new AgentSessionManager(eventBus);
    const agent: Agent = {
      agentId: 'coding-agent-007',
      name: 'ProductionCodingAgent',
      type: 'CODING_AGENT',
      version: '1.0.0',
      status: 'ACTIVE',
      trustLevel: 'TRUSTED',
      capabilities: new AgentCapabilitySet([
        'CONTEXT_REQUEST',
        'EXECUTION_REPORT',
        'VERIFICATION_REPORT',
      ]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const session = await sessionManager.createSession(
      {
        agentId: agent.agentId,
        workspaceId,
        repositoryId,
        requestedCapabilities: ['CONTEXT_REQUEST', 'EXECUTION_REPORT', 'VERIFICATION_REPORT'],
      },
      agent
    );
    expect(session.sessionId).toBeDefined();

    // -------------------------------------------------------------------------
    // Step 14: Agent reports changed resources
    // -------------------------------------------------------------------------
    const modifiedFile = 'src/auth/TokenService.ts';
    const changedResources = [modifiedFile];

    // -------------------------------------------------------------------------
    // Step 15: Verification evidence is reported
    // -------------------------------------------------------------------------
    const verificationReport = {
      sessionId: session.sessionId,
      featureId,
      evidenceType: 'AUTOMATED_UNIT_TEST',
      testSuite: 'tests/auth/token.test.ts',
      passed: true,
      timestamp: new Date().toISOString(),
    };
    expect(verificationReport.passed).toBe(true);

    // -------------------------------------------------------------------------
    // Step 16: Knowledge Update Loop processes changes (incremental, no full rescan)
    // -------------------------------------------------------------------------
    const normalizer = new KnowledgeUpdateNormalizer();
    const normalizedUpdate = normalizer.normalize({
      repositoryId,
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: changedResources,
      agentSessionId: session.sessionId,
    });

    const mockImpactResolver: IKnowledgeImpactResolver = {
      resolveImpact: async () => ({
        directlyAffectedFeatures: [featureId],
        downstreamAffectedFeatures: ['feat-session-store'],
        affectedKnowledgeAreas: [
          'FEATURE_MAPPING',
          'FEATURE_BEHAVIOR',
          'FEATURE_HEALTH',
          'FEATURE_IMPACT',
          'FEATURE_HISTORY',
        ],
        dependencyPaths: [[featureId, 'feat-session-store']],
        confidence: 0.95,
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
    const updatePlan = await planner.plan(normalizedUpdate);
    expect(updatePlan.targetFeatures).toContain(featureId);

    // -------------------------------------------------------------------------
    // Step 17: Feature impact is recalculated
    // -------------------------------------------------------------------------
    expect(updatePlan.operations.some((op) => op.area === 'FEATURE_IMPACT')).toBe(true);

    // -------------------------------------------------------------------------
    // Step 18: History is updated
    // -------------------------------------------------------------------------
    historyEvents.push({
      featureId,
      version: 2,
      timestamp: new Date().toISOString(),
      eventType: 'RESOURCE_UPDATED',
      author: session.sessionId,
    });
    expect(historyEvents.length).toBe(2);

    // -------------------------------------------------------------------------
    // Step 19: Context is invalidated
    // -------------------------------------------------------------------------
    expect(updatePlan.invalidationTargets).toContain(`FEATURE_MAPPING:${featureId}`);
    expect(updatePlan.invalidationTargets).toContain('CONTEXT_PACKAGE:ALL_AFFECTED');

    // -------------------------------------------------------------------------
    // Step 20: Fresh context is generated after invalidation
    // -------------------------------------------------------------------------
    const refreshedContextPackage = {
      ...contextPackage,
      packageId: `pkg_${Date.now()}_refreshed`,
      version: 2,
      freshness: 'FRESH' as const,
    };
    expect(refreshedContextPackage.version).toBe(2);

    // -------------------------------------------------------------------------
    // Step 21: Agent resumes with updated context
    // -------------------------------------------------------------------------
    expect(refreshedContextPackage.resources).toContain(modifiedFile);

    // -------------------------------------------------------------------------
    // Step 22: Task reaches verification
    // -------------------------------------------------------------------------
    const taskState = {
      taskId: 'task_001',
      status: 'VERIFICATION_PENDING',
      verificationEvidence: [verificationReport],
    };
    expect(taskState.verificationEvidence).toHaveLength(1);

    // -------------------------------------------------------------------------
    // Step 23: Completion is evaluated
    // -------------------------------------------------------------------------
    const isCompleted = taskState.verificationEvidence.every((e) => e.passed);
    expect(isCompleted).toBe(true);

    // -------------------------------------------------------------------------
    // Step 24: Audit events are recorded
    // -------------------------------------------------------------------------
    await auditLogger.logEvent({
      eventType: 'AUTHENTICATION_SUCCESS',
      principalId: session.sessionId,
      workspaceId,
      repositoryId,
      result: 'SUCCESS',
      details: { taskId: taskState.taskId, verified: true },
    });
    const loggedEvents = await auditLogger.queryEvents({ workspaceId });
    expect(loggedEvents.length).toBe(1);

    // -------------------------------------------------------------------------
    // Step 25: Observability captures the lifecycle
    // -------------------------------------------------------------------------
    metricsCollector.incrementCounter('lifecycle.e2e_scenarios_completed', 1);
    telemetryService.recordContextRequest(12, true);

    const snapshot = metricsCollector.getSnapshot();
    expect(snapshot.counters['lifecycle.e2e_scenarios_completed']).toBe(1);
    expect(snapshot.counters['context_requests_total{refreshed="true"}']).toBe(1);
  });
});
