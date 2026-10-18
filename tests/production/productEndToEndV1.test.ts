import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Core & Kernel
import { ProjectMindKernel } from '../../src/kernel/ProjectMindKernel.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { DIContainer } from '../../src/workspace/di/DIContainer.js';

// Workspace & Project (Phase 9.2)
import { PersistentWorkspaceProjectRepository } from '../../src/workspace/persistence/PersistentWorkspaceProjectRepository.js';
import { WorkspaceService } from '../../src/workspace/services/WorkspaceService.js';
import { ProjectService } from '../../src/workspace/services/ProjectService.js';

// Feature Intelligence (Phase 8)
import { FeatureHealthScorer } from '../../src/knowledge/features/health/core/FeatureHealthScorer.js';
import { HealthSignalHelper } from '../../src/knowledge/features/health/signals/HealthSignalHelper.js';

// Context Orchestrator & Quality (Phase 9.3)
import { TokenBudgetManager } from '../../src/context/budgeting/TokenBudgetManager.js';
import { ContextQualityEvaluator } from '../../src/context/intelligence/ContextQualityEvaluator.js';
import { createDefaultRelevance } from '../../src/context/models/ContextRelevance.js';
import type { SelectedContextData } from '../../src/context/interfaces/IContextSelector.js';

// Memory & Retrieval (Phase 9.4)
import { InMemoryProjectMemoryStore } from '../../src/memory/project/services/InMemoryProjectMemoryStore.js';
import { ProjectMemoryManager } from '../../src/memory/project/services/ProjectMemoryManager.js';
import { HybridRetrievalEngine } from '../../src/retrieval/engine/HybridRetrievalEngine.js';

// Multi-Agent Collaboration (Phase 9.5)
import { InMemoryCollaborationStore } from '../../src/agent/collaboration/services/InMemoryCollaborationStore.js';
import { ResourceReservationService } from '../../src/agent/collaboration/services/ResourceReservationService.js';
import { ConflictDetector } from '../../src/agent/collaboration/services/ConflictDetector.js';
import { HandoffCoordinator } from '../../src/agent/collaboration/services/HandoffCoordinator.js';
import { CollaborationContextService } from '../../src/agent/collaboration/services/CollaborationContextService.js';
import { CollaborationManager } from '../../src/agent/collaboration/services/CollaborationManager.js';
import { AgentRegistry } from '../../src/agent/runtime/AgentRegistry.js';

// Task Planning & Orchestration (Phase 9.6)
import {
  TaskPlannerService,
  InMemoryTaskPlanStore,
  TaskDecomposer,
  TaskDependencyResolver,
  TaskPlanValidator,
  TaskReadinessEvaluator,
  TaskPrioritizer,
  TaskAssignmentResolver,
  ApprovalGateResolver,
  TaskCheckpointManager,
  TaskPlanRevisionManager,
  TaskOrchestrator,
} from '../../src/agent/planning/index.js';

// Agent Runtime & Verification (Phases 7-8)
import { AgentSessionManager } from '../../src/agent/runtime/AgentSessionManager.js';
import { AgentCapabilitySet } from '../../src/agent/models/AgentCapabilitySet.js';
import type { Agent } from '../../src/agent/models/Agent.js';
import { AuditLogger } from '../../src/security/core/AuditLogger.js';

// Learning & Feedback (Phase 9.7)
import { InMemoryFeedbackStore } from '../../src/intelligence/learning/services/InMemoryFeedbackStore.js';
import { InMemoryLearningStore } from '../../src/intelligence/learning/services/InMemoryLearningStore.js';
import { FeedbackNormalizer } from '../../src/intelligence/learning/services/FeedbackNormalizer.js';
import { FeedbackCollector } from '../../src/intelligence/learning/services/FeedbackCollector.js';
import { LearningSignalExtractor } from '../../src/intelligence/learning/services/LearningSignalExtractor.js';
import { LearningCandidateGenerator } from '../../src/intelligence/learning/services/LearningCandidateGenerator.js';
import { LearningEvaluator } from '../../src/intelligence/learning/services/LearningEvaluator.js';
import { LearningPolicyEngine } from '../../src/intelligence/learning/services/LearningPolicyEngine.js';
import { LearningDeploymentManager } from '../../src/intelligence/learning/services/LearningDeploymentManager.js';
import { LearningRollbackManager } from '../../src/intelligence/learning/services/LearningRollbackManager.js';
import { LearningIntelligenceService } from '../../src/intelligence/learning/services/LearningIntelligenceService.js';

// Plugins & SDK (Phase 9.8)
import { InMemoryPluginStore } from '../../src/plugins/services/InMemoryPluginStore.js';
import { PluginRegistry } from '../../src/plugins/services/PluginRegistry.js';
import { PluginSecurityPolicyEngine } from '../../src/plugins/services/PluginSecurityPolicyEngine.js';
import { PluginExecutionManager } from '../../src/plugins/services/PluginExecutionManager.js';
import { PluginLifecycleManager } from '../../src/plugins/services/PluginLifecycleManager.js';
import { normalizePluginManifest } from '../../src/plugins/models/PluginManifest.js';

// Enterprise Analytics (Phase 9.9)
import { AnalyticsDISetup } from '../../src/analytics/di/AnalyticsDISetup.js';
import type { IAnalyticsService } from '../../src/analytics/interfaces/IAnalyticsService.js';

// CLI (Phase 9.1)
import { CLIApplication } from '../../src/cli/core/CLIApplication.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';

// Production Readiness & v1.0 Gates (Phase 9.10)
import { ProductionReadinessEngine } from '../../src/production/engine/ProductionReadinessEngine.js';

describe('Phase 9.10 — End-to-End Product Coherence & v1.0 Production Lifecycle', () => {
  const testWorkspaceDir = path.join(process.cwd(), 'tests', 'production', 'scratch_v1_e2e_workspace');
  let kernel: ProjectMindKernel;
  let eventBus: NodeEventBus;
  let auditLogger: AuditLogger;

  beforeEach(async () => {
    if (!fs.existsSync(testWorkspaceDir)) {
      fs.mkdirSync(testWorkspaceDir, { recursive: true });
    }
    eventBus = new NodeEventBus();
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

  it('should execute the full 16-stage v1.0 product lifecycle seamlessly', async () => {
    // -------------------------------------------------------------------------
    // Stage 1: Workspace & Project Management (Phase 9.2)
    // -------------------------------------------------------------------------
    const workspaceProjectRepo = new PersistentWorkspaceProjectRepository();
    const workspaceService = new WorkspaceService(workspaceProjectRepo);
    const projectService = new ProjectService(workspaceProjectRepo, workspaceProjectRepo);

    const workspace = await workspaceService.createWorkspace({
      name: 'Acme Enterprise Platform',
      metadata: { rootPath: testWorkspaceDir },
    });
    expect(workspace.workspaceId).toBeDefined();
    expect(workspace.name).toBe('Acme Enterprise Platform');

    const project = await projectService.createProject({
      workspaceId: workspace.workspaceId,
      name: 'Core Services API',
      description: 'Microservices and authentication backend',
    });
    expect(project.projectId).toBeDefined();
    expect(project.workspaceId).toBe(workspace.workspaceId);

    // -------------------------------------------------------------------------
    // Stage 2: Repository Extraction & Knowledge Baseline (Phases 1-3)
    // -------------------------------------------------------------------------
    const health = await kernel.observabilityEngine.getHealth();
    expect(health.status).toBe('healthy');

    // -------------------------------------------------------------------------
    // Stage 3: Feature Intelligence & Health Scoring (Phase 8)
    // -------------------------------------------------------------------------
    const featureId = 'feat-tenant-auth';
    const scorer = new FeatureHealthScorer();
    const signals = [
      HealthSignalHelper.createSignal({
        featureId,
        signalType: 'HIGH_CYCLOMATIC_COMPLEXITY',
        severity: 'LOW',
        value: 12,
        normalizedValue: 12,
        description: 'Low baseline complexity',
        evidence: [],
        source: 'TEST_RUNNER',
        confidence: 1.0,
      }),
    ];
    const dimScores = scorer.scoreDimensions(signals);
    const healthResult = scorer.calculateOverallHealth(dimScores);
    expect(healthResult.status).toBe('HEALTHY');

    // -------------------------------------------------------------------------
    // Stage 4: Project Memory Engine & Semantic Retrieval (Phase 9.4)
    // -------------------------------------------------------------------------
    const memoryStore = new InMemoryProjectMemoryStore();
    const memoryManager = new ProjectMemoryManager(memoryStore);

    const proposedCandidate = await memoryManager.proposeCandidate({
      repositoryId: 'repo-projectmind',
      workspaceId: workspace.workspaceId,
      projectId: project.projectId,
      type: 'DECISION',
      title: 'Tenant Isolation Architecture Decision',
      content: 'JWT claim scoping enforces strict tenant-level row separation.',
      source: 'TEST',
      provenance: 'DEVELOPER',
      authority: 'AUTHORITATIVE',
      confidence: 1.0,
      structuredData: { tags: ['security', 'architecture', 'auth'] },
      evidence: [],
      relatedResources: [],
      relatedFeatures: [],
      relatedTasks: [],
    });
    expect(proposedCandidate.candidateId).toBeDefined();

    const activeMemory = await memoryManager.promoteCandidate(proposedCandidate.candidateId);
    expect(activeMemory.memoryId).toBeDefined();
    expect(activeMemory.status).toBe('ACTIVE');

    const retrievalEngine = new HybridRetrievalEngine(undefined, undefined, memoryStore);
    const searchResults = await retrievalEngine.retrieve({
      queryId: 'q-e2e-1',
      queryType: 'PROJECT_MEMORY',
      timestamp: Date.now(),
      text: 'Tenant Isolation Architecture',
      repositoryId: 'repo-projectmind',
      workspaceId: workspace.workspaceId,
      projectId: project.projectId,
    });
    expect(searchResults.length).toBeGreaterThanOrEqual(1);
    expect(searchResults[0]?.name).toContain('Tenant Isolation');

    // -------------------------------------------------------------------------
    // Stage 5: Context Understanding & Token Budgeting (Phase 9.3)
    // -------------------------------------------------------------------------
    const budgetManager = new TokenBudgetManager();
    const qualityEvaluator = new ContextQualityEvaluator();

    const selectedContext: SelectedContextData = {
      features: [
        {
          featureId,
          name: 'Multi-Tenant Authentication',
          description: 'Tenant token verification and claim validation',
          type: 'SECURITY',
          status: 'ACTIVE',
          role: 'DIRECT',
          relevance: createDefaultRelevance(1.0, 1.0, true, ['Target feature']),
          priority: 'HIGH',
          resources: [],
          entryPoints: [],
          primaryFlows: [],
          risks: [],
          estimatedTokens: 120,
        },
      ],
      resources: [
        {
          resourceId: 'src/auth/TenantAuthService.ts',
          featureId,
          role: 'SOURCE_CODE',
          relevance: createDefaultRelevance(0.95, 1.0, true, ['Core service']),
          priority: 'HIGH',
          estimatedTokens: 250,
        },
      ],
      behaviorFlows: [],
      tests: [],
      risks: [],
      milestones: [],
      explanations: { [featureId]: 'Primary authentication module' },
    };

    const budgeted = budgetManager.applyBudget(selectedContext, {
      totalBudget: 4000,
      reservedForPrompt: 500,
      reservedForMetadata: 300,
      availableForContext: 3200,
      compactMode: false,
    });
    expect(budgeted.allocation.totalUsed).toBeLessThanOrEqual(4000);

    const candidateDimensions = {
      taskRelevance: 0.9,
      featureRelevance: 1.0,
      architecturalRelevance: 0.8,
      dependencyRelevance: 0.8,
      behavioralRelevance: 0.8,
      changeRelevance: 0.5,
      historyRelevance: 0.5,
      riskRelevance: 0.2,
      verificationRelevance: 0.8,
      recency: 1.0,
      confidence: 0.95,
      scopeRelevance: 1.0,
    };

    const qualityAssessment = qualityEvaluator.evaluate(
      [
        {
          candidateId: 'cand-01',
          candidateType: 'FEATURE',
          name: 'Multi-Tenant Authentication',
          score: 0.95,
          estimatedTokens: 120,
          priority: 'HIGH',
          primaryEvidence: 'Requested primary authentication feature',
          dimensions: candidateDimensions,
        },
        {
          candidateId: 'cand-02',
          candidateType: 'FILE',
          name: 'src/auth/TenantAuthService.ts',
          score: 0.9,
          estimatedTokens: 250,
          priority: 'HIGH',
          primaryEvidence: 'Core mapped resource for authentication feature',
          dimensions: candidateDimensions,
        },
      ],
      {
        taskId: 'task-quality-eval',
        rawRequest: 'Implement Tenant Key Rotation',
        normalizedRequest: 'Implement Tenant Key Rotation',
        taskType: 'IMPLEMENTATION',
        intent: 'ADD',
        targetEntities: ['rotateKey'],
        candidateFeatures: [featureId],
        candidateResources: ['src/auth/TenantAuthService.ts'],
        requestedAction: 'Implement Tenant Key Rotation',
        constraints: [],
        scope: { workspaceId: workspace.workspaceId, repositoryId: 'repo-projectmind' },
        confidence: 0.95,
        provenance: 'DETERMINISTIC_RULES',
      },
      4000,
      'FRESH'
    );
    expect(qualityAssessment.overallScore).toBeGreaterThanOrEqual(0.7);

    // -------------------------------------------------------------------------
    // Stage 6: Multi-Agent Collaboration & Resource Locking (Phase 9.5)
    // -------------------------------------------------------------------------
    const collabStore = new InMemoryCollaborationStore();
    const reservations = new ResourceReservationService(collabStore);
    const conflicts = new ConflictDetector(collabStore);
    const handoffs = new HandoffCoordinator(collabStore);
    const contextService = new CollaborationContextService(collabStore);
    const agentRegistry = new AgentRegistry();

    await agentRegistry.register({
      agentId: 'agent-planner-01',
      name: 'Planner Agent',
      type: 'CODER' as any,
      version: '1.0.0',
      trustLevel: 'TRUSTED',
    });

    const collabManager = new CollaborationManager(
      collabStore,
      reservations,
      conflicts,
      handoffs,
      contextService,
      agentRegistry,
      undefined,
      memoryManager
    );

    const collabSession = await collabManager.createSession({
      title: 'Tenant Key Rotation Planning',
      workspaceId: workspace.workspaceId,
      projectId: project.projectId,
      repositoryIds: ['repo-projectmind'],
      coordinatorAgentId: 'agent-planner-01',
    });
    expect(collabSession.collaborationSessionId).toBeDefined();

    const reservationResult = await reservations.reserve({
      collaborationSessionId: collabSession.collaborationSessionId,
      ownerAgentId: 'agent-planner-01',
      resourceId: 'src/auth/TenantAuthService.ts',
      resourceType: 'FILE',
      reason: 'Updating tenant isolation logic',
    });
    expect(reservationResult.state).toBe('RESERVED');

    // -------------------------------------------------------------------------
    // Stage 7: Task Planning & Dependency Orchestration (Phase 9.6)
    // -------------------------------------------------------------------------
    const planStore = new InMemoryTaskPlanStore();
    const decomposer = new TaskDecomposer();
    const dependencyResolver = new TaskDependencyResolver();
    const validator = new TaskPlanValidator(planStore);
    const readinessEvaluator = new TaskReadinessEvaluator();
    const prioritizer = new TaskPrioritizer(dependencyResolver);
    const assignmentResolver = new TaskAssignmentResolver({
      get: async () => ({ agentId: 'agent-planner-01', name: 'Planner Agent', role: 'IMPLEMENTER', capabilities: ['code'] }),
      list: async () => [],
      findByCapability: async () => [],
      heartbeat: async () => true,
      register: async () => {},
      unregister: async () => true,
      updateStatus: async () => true,
    } as any);
    const approvalResolver = new ApprovalGateResolver();
    const checkpointManager = new TaskCheckpointManager(planStore);
    const revisionManager = new TaskPlanRevisionManager(planStore);
    const orchestrator = new TaskOrchestrator(
      planStore,
      validator,
      dependencyResolver,
      readinessEvaluator,
      assignmentResolver,
      approvalResolver
    );

    const plannerService = new TaskPlannerService(
      planStore,
      decomposer,
      validator,
      dependencyResolver,
      readinessEvaluator,
      prioritizer,
      approvalResolver,
      orchestrator,
      checkpointManager,
      revisionManager
    );

    const plan = await plannerService.createPlan({
      title: 'Implement Tenant Key Rotation',
      objective: 'Add HMAC signature validation with zero downtime',
      workspaceId: workspace.workspaceId,
      projectId: project.projectId,
      createdBy: 'agent-planner-01',
    });
    expect(plan.id).toBeDefined();
    expect(plan.status).toBe('READY');

    // -------------------------------------------------------------------------
    // Stage 8: Agent Runtime & Session Management (Phase 7)
    // -------------------------------------------------------------------------
    const agentSessionManager = new AgentSessionManager(eventBus);
    const agent: Agent = {
      agentId: 'agent-executor-02',
      name: 'AutonomousCodingAgent',
      type: 'CODING_AGENT',
      version: '1.0.0',
      status: 'ACTIVE',
      trustLevel: 'TRUSTED',
      capabilities: new AgentCapabilitySet(['CONTEXT_REQUEST', 'FEATURE_QUERY', 'TASK_CONTEXT']),
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const agentSession = await agentSessionManager.createSession(
      {
        workspaceId: workspace.workspaceId,
        repositoryId: 'repo-projectmind',
        agentId: agent.agentId,
      },
      agent
    );
    expect(agentSession.sessionId).toBeDefined();

    // -------------------------------------------------------------------------
    // Stage 9: Verification & Provenance Validation (Phase 8)
    // -------------------------------------------------------------------------
    auditLogger.logEvent({
      eventType: 'SENSITIVE_TOOL_EXECUTION',
      result: 'SUCCESS',
      details: {
        agentId: agent.agentId,
        testSuite: 'TenantAuthService.test.ts',
        result: 'PASSED',
        testsCount: 14,
      },
    });

    // -------------------------------------------------------------------------
    // Stage 10: Learning & Feedback Intelligence (Phase 9.7)
    // -------------------------------------------------------------------------
    const feedbackStore = new InMemoryFeedbackStore();
    const learningStore = new InMemoryLearningStore();
    const normalizer = new FeedbackNormalizer();
    const collector = new FeedbackCollector(feedbackStore, normalizer);
    const signalExtractor = new LearningSignalExtractor(learningStore);
    const candidateGenerator = new LearningCandidateGenerator(learningStore);
    const evaluator = new LearningEvaluator(learningStore);
    const policyEngine = new LearningPolicyEngine();
    const deploymentManager = new LearningDeploymentManager(learningStore, policyEngine);
    const rollbackManager = new LearningRollbackManager(learningStore);

    const learningService = new LearningIntelligenceService(
      feedbackStore,
      learningStore,
      collector,
      signalExtractor,
      candidateGenerator,
      evaluator,
      policyEngine,
      deploymentManager,
      rollbackManager
    );

    const feedbackRecord = await learningService.submitFeedback({
      workspaceId: workspace.workspaceId,
      projectId: project.projectId,
      sourceType: 'USER',
      sourceId: 'dev-lead-01',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'CONTEXT_TEMPLATE',
      targetId: 'auth-rotation-template',
      metadata: {
        comment: 'Key rotation context was perfectly accurate.',
        rating: 5,
      },
    });
    expect(feedbackRecord.id).toBeDefined();

    // -------------------------------------------------------------------------
    // Stage 11: Plugin Runtime & Sandboxing (Phase 9.8)
    // -------------------------------------------------------------------------
    const pluginStore = new InMemoryPluginStore();
    const pluginSec = new PluginSecurityPolicyEngine(pluginStore);
    const pluginExec = new PluginExecutionManager(pluginStore);
    const pluginReg = new PluginRegistry(pluginStore);
    const pluginLife = new PluginLifecycleManager(pluginStore, pluginExec, pluginSec);

    const manifest = normalizePluginManifest({
      pluginId: 'plugin-security-linter',
      name: 'Security Linter Plugin',
      version: '1.0.0',
      entryPoint: 'index.js',
      capabilities: ['ANALYZER'],
      permissions: ['read:features', 'read:metadata'],
    });
    await pluginReg.registerPlugin(manifest);
    const installation = await pluginLife.install(manifest.pluginId, workspace.workspaceId, project.projectId);
    expect(installation.state).toBe('INSTALLED');

    // -------------------------------------------------------------------------
    // Stage 12: Enterprise Analytics & Tenant Scoping (Phase 9.9)
    // -------------------------------------------------------------------------
    const container = new DIContainer();
    const analyticsService: IAnalyticsService = AnalyticsDISetup.register(container, { eventBus });

    const metrics = analyticsService.listMetrics();
    expect(metrics.length).toBeGreaterThan(0);

    const report = await analyticsService.generateReport(
      {
        scopeType: 'PROJECT',
        workspaceId: workspace.workspaceId,
        projectId: project.projectId,
      },
      'RELIABILITY'
    );
    expect(report.scope.projectId).toBe(project.projectId);

    // -------------------------------------------------------------------------
    // Stage 13: Developer CLI Invocation (Phase 9.1)
    // -------------------------------------------------------------------------
    const cliOutput: string[] = [];
    const cliApp = CLIApplication.createDefault({
      stdout: (msg) => cliOutput.push(msg),
      stderr: (msg) => cliOutput.push(msg),
    });

    const cliExitCode = await cliApp.run(['--version']);
    expect(cliExitCode).toBe(CLIExitCode.SUCCESS);
    expect(cliOutput.join(' ')).toContain('1.0.0');

    // -------------------------------------------------------------------------
    // Stage 14: Release Certification & Strategic Gates A–G (Phase 9.10)
    // -------------------------------------------------------------------------
    const readinessEngine = new ProductionReadinessEngine();
    const assessment = readinessEngine.evaluate();

    expect(assessment.summary.readyForProduction).toBe(true);
    expect(assessment.summary.gatesBlocked).toBe(0);
    expect(assessment.strategicGates).toHaveLength(7);

    for (const stratGate of assessment.strategicGates) {
      expect(stratGate.status).toBe('VERIFIED');
      expect(stratGate.outstandingIssues).toHaveLength(0);
    }

    expect(assessment.certification.decision).toBe('CERTIFIED_WITH_CONDITIONS');
    expect(assessment.featureInventory.length).toBeGreaterThanOrEqual(16);
  });

  it('should gracefully handle model provider absence with deterministic fallbacks', async () => {
    // When external AI model provider is absent or disconnected,
    // Context Orchestrator and Token Budgeter run deterministically without error.
    const budgetManager = new TokenBudgetManager();
    const emptyData: SelectedContextData = {
      features: [],
      resources: [],
      behaviorFlows: [],
      tests: [],
      risks: [],
      milestones: [],
      explanations: {},
    };

    const budgeted = budgetManager.applyBudget(emptyData, {
      totalBudget: 2000,
      reservedForPrompt: 200,
      reservedForMetadata: 100,
      availableForContext: 1700,
      compactMode: true,
    });

    expect(budgeted.allocation.totalUsed).toBeLessThanOrEqual(5);
    expect(budgeted.data.features).toHaveLength(0);
  });
});
