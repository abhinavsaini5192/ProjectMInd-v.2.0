import type { IContextOrchestrator } from '../../../src/context/interfaces/IContextOrchestrator.js';
import type { IFeatureKnowledgeAPI } from '../../../src/knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { IAgentSessionManager } from '../../../src/agent/interfaces/IAgentSessionManager.js';
import type { IEventBus } from '../../../src/workspace/interfaces/IEventBus.js';
import type { ContextRequest } from '../../../src/context/models/ContextRequest.js';
import type { ContextResponse } from '../../../src/context/models/ContextResponse.js';
import type { ContextPackage } from '../../../src/context/models/ContextPackage.js';
import { InMemoryAgentContextStore } from '../../../src/agent/context/services/InMemoryAgentContextStore.js';
import { AgentContextPinManager } from '../../../src/agent/context/services/AgentContextPinManager.js';
import { AgentContextDeltaCalculator } from '../../../src/agent/context/services/AgentContextDeltaCalculator.js';
import { AgentContextInvalidator } from '../../../src/agent/context/services/AgentContextInvalidator.js';
import { AgentContextRefresher } from '../../../src/agent/context/services/AgentContextRefresher.js';
import { AgentContextSessionManager } from '../../../src/agent/context/services/AgentContextSessionManager.js';
import type { AgentSession } from '../../../src/agent/models/AgentSession.js';

export function createMockContextPackage(overrides?: Partial<ContextPackage>): ContextPackage {
  return {
    packageId: overrides?.packageId ?? 'pkg_test_1',
    generatedAt: overrides?.generatedAt ?? Date.now(),
    task: overrides?.task ?? { text: 'Fix login request timeout' },
    features: overrides?.features ?? [
      {
        featureId: 'feat-auth',
        name: 'Authentication',
        description: 'Authentication and session services',
        entryPoints: ['src/auth/AuthController.ts'],
        components: ['AuthController', 'AuthService'],
        primaryRole: 'CORE',
      } as any,
      {
        featureId: 'feat-session',
        name: 'Session Management',
        description: 'User sessions and tokens',
        entryPoints: ['src/session/SessionService.ts'],
        components: ['SessionService'],
        primaryRole: 'SERVICE',
      } as any,
    ],
    resources: overrides?.resources ?? [
      {
        resourceId: 'res-auth-service',
        path: 'src/auth/AuthService.ts',
        tokenCount: 450,
        content: 'export class AuthService { login() {} }',
        contentHash: 'hash_auth_1',
      } as any,
      {
        resourceId: 'res-auth-controller',
        path: 'src/auth/AuthController.ts',
        tokenCount: 300,
        content: 'export class AuthController {}',
        contentHash: 'hash_ctrl_1',
      } as any,
      {
        resourceId: 'res-session-service',
        path: 'src/session/SessionService.ts',
        tokenCount: 400,
        content: 'export class SessionService {}',
        contentHash: 'hash_sess_1',
      } as any,
    ],
    behavior: overrides?.behavior ?? [
      { flowId: 'flow-login', name: 'User Login Flow', steps: ['validate', 'token', 'session'] },
    ],
    dependencies: overrides?.dependencies ?? [
      { sourceFeature: 'feat-auth', targetFeature: 'feat-session', type: 'CALLS' },
    ],
    tests: overrides?.tests ?? [
      { testId: 'test-auth', path: 'tests/auth/auth.test.ts', targetFeatureId: 'feat-auth' },
    ],
    health: overrides?.health ?? { score: 92, status: 'HEALTHY' },
    impact: overrides?.impact ?? { affectedFeatures: ['feat-auth', 'feat-session'] },
    history: overrides?.history ?? [],
    warnings: overrides?.warnings ?? [],
    selectionReasons: overrides?.selectionReasons ?? {
      'feat-auth': 'Direct match with task intent',
      'src/auth/AuthService.ts': 'Core logic for login timeout',
    },
    completeness: overrides?.completeness ?? { score: 0.95, level: 'HIGH' } as any,
    freshness: overrides?.freshness ?? {
      status: 'CURRENT',
      isStale: false,
      lastVerifiedAt: Date.now(),
      invalidationReasons: [],
      staleReasons: [],
    },
    estimatedTokens: overrides?.estimatedTokens ?? 1600,
    version: overrides?.version ?? {
      packageVersion: '1.0.0',
      knowledgeVersion: '1.0.0',
      modelVersion: '1.0.0',
      generationTimestamp: Date.now(),
      isConsistent: true,
      mismatchedSubsystems: [],
    },
  };
}

export function createMockContextOrchestrator(
  customPackage?: ContextPackage
): IContextOrchestrator {
  let pkg = customPackage ?? createMockContextPackage();
  return {
    async orchestrateContext(request: ContextRequest): Promise<ContextResponse> {
      // If specific features or resources requested, adapt package
      return {
        success: true,
        warnings: [],
        durationMs: 10,
        cached: false,
        package: {
          ...pkg,
          task: { text: request.taskText ?? pkg.task.text },
        },
        plan: {
          planId: 'plan_test_1',
          steps: [],
          targetTokenBudget: request.tokenBudget ?? 8000,
        } as any,
      };
    },
    async getContextPlan() { return {} as any; },
    async getContextPackage() { return pkg; },
    async getFeatureContextForTask() { return {} as any; },
    async getContextExplanation() { return {} as any; },
    async estimateContextTokens() { return 1500; },
    validateContextRequest() {},
  };
}

export function createMockFeatureKnowledgeApi(): IFeatureKnowledgeAPI {
  return {
    async getFeatureImpact(featureId: string) {
      if (featureId === 'feat-auth') {
        return {
          affectedFeatures: ['feat-session'],
          affectedFiles: ['src/auth/AuthService.ts', 'src/auth/AuthController.ts'],
        } as any;
      }
      return {
        affectedFeatures: [],
        affectedFiles: [],
      } as any;
    },
    async getFeatureKnowledge() { return {} as any; },
    async getFeatureProfile() { return {} as any; },
    async getFeatureSummary() { return {} as any; },
    async getFeatureMappings() { return {} as any; },
    async getFeatureDependencies() { return {} as any; },
    async getFeatureDependents() { return {} as any; },
    async getFeatureBehavior() { return {} as any; },
    async getFeatureHealth() { return {} as any; },
    async getFeatureHistory() { return {} as any; },
    async getFeatureArchitecture() { return {} as any; },
    async getFeatureContext() { return {} as any; },
    async explainFeatureKnowledge() { return {}; },
    async getKnowledgeCompleteness() { return {} as any; },
    async getKnowledgeFreshness() { return {} as any; },
    async getKnowledgeVersionStatus() { return {} as any; },
  };
}

export function createMockEventBus(): IEventBus & { readonly published: { event: string; payload: any }[] } {
  const published: { event: string; payload: any }[] = [];
  return {
    published,
    publish(eventName: string, payload: any) {
      published.push({ event: eventName, payload });
    },
    subscribe() {},
    unsubscribe() {},
  };
}

export function createMockAgentSessionManager(
  workspaceId = 'ws-test-1',
  repositoryId = 'repo-test-1'
): IAgentSessionManager & { registerSession: (session: AgentSession) => void } {
  const sessions = new Map<string, AgentSession>();
  return {
    registerSession(session: AgentSession) {
      sessions.set(session.sessionId, session);
    },
    async createSession(params: any, agent: any) {
      const session: AgentSession = {
        sessionId: params.sessionId ?? 'session-123',
        agentId: agent?.id ?? 'agent-test',
        agentType: 'CODING',
        status: 'ACTIVE',
        capabilities: params.requestedCapabilities ?? [],
        workspaceContext: {
          workspaceId: params.workspaceContext?.workspaceId ?? workspaceId,
          repositoryId: params.workspaceContext?.repositoryId ?? repositoryId,
        },
        createdAt: new Date(),
        lastActivityAt: new Date(),
        metadata: {},
      } as any;
      sessions.set(session.sessionId, session);
      return session;
    },
    async getSession(sessionId: string) {
      return sessions.get(sessionId);
    },
    async touchSession(sessionId: string) { return this.getSession(sessionId) as any; },
    async closeSession(sessionId: string) { return sessions.delete(sessionId); },
    async listSessionsForAgent() { return Array.from(sessions.values()); },
    validateSessionScope() {},
  };
}

export interface ContextHarness {
  store: InMemoryAgentContextStore;
  pinManager: AgentContextPinManager;
  deltaCalculator: AgentContextDeltaCalculator;
  invalidator: AgentContextInvalidator;
  refresher: AgentContextRefresher;
  sessionManager: AgentContextSessionManager;
  contextOrchestrator: IContextOrchestrator;
  featureKnowledgeApi: IFeatureKnowledgeAPI;
  eventBus: ReturnType<typeof createMockEventBus>;
  agentSessionManager: IAgentSessionManager;
}

export function createContextHarness(customPackage?: ContextPackage): ContextHarness {
  const store = new InMemoryAgentContextStore();
  const pinManager = new AgentContextPinManager(store);
  const deltaCalculator = new AgentContextDeltaCalculator();
  const contextOrchestrator = createMockContextOrchestrator(customPackage);
  const featureKnowledgeApi = createMockFeatureKnowledgeApi();
  const eventBus = createMockEventBus();
  const agentSessionManager = createMockAgentSessionManager();

  const invalidator = new AgentContextInvalidator(featureKnowledgeApi);
  const refresher = new AgentContextRefresher(contextOrchestrator);

  const sessionManager = new AgentContextSessionManager({
    store,
    pinManager,
    deltaCalculator,
    invalidator,
    refresher,
    contextOrchestrator,
    sessionManager: agentSessionManager,
    eventBus,
  });

  return {
    store,
    pinManager,
    deltaCalculator,
    invalidator,
    refresher,
    sessionManager,
    contextOrchestrator,
    featureKnowledgeApi,
    eventBus,
    agentSessionManager,
  };
}
