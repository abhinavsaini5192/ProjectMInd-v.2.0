import type { IFeatureRepository } from '../../../../src/knowledge/features/interfaces/IFeatureRepository.js';
import type { IFeatureMappingRepository } from '../../../../src/knowledge/features/mapping/interfaces/IFeatureMappingRepository.js';
import type { IFeatureRelationshipRepository } from '../../../../src/knowledge/features/dependencies/interfaces/IFeatureRelationshipRepository.js';
import type { IFeatureBehaviorRepository } from '../../../../src/knowledge/features/behavior/interfaces/IFeatureBehaviorRepository.js';
import type { IFeatureHealthRepository } from '../../../../src/knowledge/features/health/interfaces/IFeatureHealthRepository.js';
import type { IImpactRepository } from '../../../../src/knowledge/features/impact/interfaces/IImpactRepository.js';
import type { IFeatureHistoryRepository } from '../../../../src/knowledge/features/history/interfaces/IFeatureHistoryRepository.js';

import { FeatureKnowledgePlanner } from '../../../../src/knowledge/features/api/core/FeatureKnowledgePlanner.js';
import { FeatureKnowledgeFreshnessResolver } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeFreshnessResolver.js';
import { FeatureKnowledgeExplainer } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeExplainer.js';
import { FeatureKnowledgeResolver } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeResolver.js';
import { FeatureKnowledgeAssembler } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeAssembler.js';
import { FeatureKnowledgeQueryService } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeQueryService.js';
import { FeatureKnowledgeAPI } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeAPI.js';
import { FeatureKnowledgeCache } from '../../../../src/knowledge/features/api/cache/FeatureKnowledgeCache.js';

export function createMockFeatureRepository(features: any[] = []): IFeatureRepository {
  const store = new Map<string, any>();
  for (const f of features) {
    const id = typeof f.id === 'string' ? f.id : f.id?.value ?? String(f.id);
    store.set(id, f);
  }

  return {
    create: async (f: any) => { store.set(f.id, f); },
    get: async (id: any) => {
      const key = typeof id === 'string' ? id : id?.value ?? String(id);
      return store.get(key) ?? null;
    },
    update: async (f: any) => { store.set(f.id, f); },
    delete: async (id: any) => store.delete(typeof id === 'string' ? id : id?.value ?? String(id)),
    exists: async (id: any) => store.has(typeof id === 'string' ? id : id?.value ?? String(id)),
    list: async () => Array.from(store.values()),
    findByName: async (name: string) => Array.from(store.values()).filter((f) => f.name === name),
    findByReference: async () => [],
    findByType: async () => [],
    findByStatus: async () => [],
  };
}

export function createMockMappingRepository(mappingsByFeature: Record<string, any[]> = {}): IFeatureMappingRepository {
  return {
    save: async () => {},
    update: async () => {},
    get: async () => null,
    getMappings: async (featureId: string) => mappingsByFeature[featureId] ?? [],
    getMappingsByRole: async (featureId: string, role: any) =>
      (mappingsByFeature[featureId] ?? []).filter((m) => m.role === role),
    getResourceFeatures: async () => [],
    deactivate: async () => {},
    queryConflicts: async () => [],
    saveConflict: async () => {},
    getAll: async () => Object.values(mappingsByFeature).flat(),
  };
}

export function createMockRelationshipRepository(
  relationshipsByFeature: Record<string, { outgoing: any[]; incoming: any[] }> = {}
): IFeatureRelationshipRepository {
  return {
    save: async () => {},
    update: async () => {},
    get: async () => null,
    getRelationships: async (featureId: string) => {
      const entry = relationshipsByFeature[featureId];
      return [...(entry?.outgoing ?? []), ...(entry?.incoming ?? [])];
    },
    getOutgoing: async (featureId: string) => relationshipsByFeature[featureId]?.outgoing ?? [],
    getIncoming: async (featureId: string) => relationshipsByFeature[featureId]?.incoming ?? [],
    getBetween: async () => null,
    getByType: async () => [],
    getAll: async () => [],
    deactivate: async () => {},
    saveConflict: async () => {},
    queryConflicts: async () => [],
  };
}

export function createMockBehaviorRepository(behaviorsByFeature: Record<string, any> = {}): IFeatureBehaviorRepository {
  return {
    saveBehavior: async () => {},
    getBehavior: async (featureId: any) => {
      const key = typeof featureId === 'string' ? featureId : featureId?.value ?? String(featureId);
      return behaviorsByFeature[key] ?? null;
    },
    getAllBehaviors: async () => Object.values(behaviorsByFeature),
    getFlow: async () => null,
    saveConflict: async () => {},
    getConflicts: async () => [],
    resolveConflict: async () => {},
    deleteBehavior: async () => true,
    clear: async () => {},
  };
}

export function createMockHealthRepository(healthsByFeature: Record<string, any> = {}): IFeatureHealthRepository {
  return {
    save: async () => {},
    saveBatch: async () => {},
    getById: async () => null,
    getByFeatureId: async (featureId: string) => healthsByFeature[featureId] ?? null,
    getAll: async () => Object.values(healthsByFeature),
    delete: async () => true,
    markStale: async () => {},
    clear: async () => {},
  };
}

export function createMockImpactRepository(impactsByFeature: Record<string, any[]> = {}): IImpactRepository {
  return {
    saveResult: async () => {},
    getResult: async () => null,
    getLatestResult: async () => null,
    getFeatureImpacts: async (featureId: string) => impactsByFeature[featureId] ?? [],
    getResourceImpacts: async () => [],
    getAllFeatureImpacts: async () => Object.values(impactsByFeature).flat(),
    getAllResourceImpacts: async () => [],
    getImpactPath: async () => null,
    findImpactPaths: async () => [],
    getConflicts: async () => [],
    markStale: async () => {},
    invalidateByFeature: async () => {},
    clear: async () => {},
  };
}

export function createMockHistoryRepository(historiesByFeature: Record<string, any> = {}): IFeatureHistoryRepository {
  return {
    saveHistory: async () => {},
    getHistory: async (featureId: string) => historiesByFeature[featureId] ?? null,
    getAllHistories: async () => Object.values(historiesByFeature),
    deleteHistory: async () => true,
    saveSnapshot: async () => {},
    getSnapshots: async () => [],
    getSnapshot: async () => null,
    saveEvents: async () => {},
    getEvents: async () => [],
    getEvent: async () => null,
    saveConflicts: async () => {},
    getConflicts: async () => [],
  };
}

export function createSyntheticAuthenticationScenario() {
  const authFeature = {
    id: 'feat_auth',
    name: 'Authentication',
    description: 'Handles user authentication and session management',
    type: 'USER_FACING',
    status: 'ACTIVE',
    workspaceId: 'ws_main',
    repositoryId: 'repo_main',
    updatedAt: Date.now() - 10000,
    createdAt: Date.now() - 1000000,
  };

  const authMappings = [
    { mappingId: 'map_1', resourceId: 'POST /login', role: 'PRIMARY', confidence: 0.98, active: true },
    { mappingId: 'map_2', resourceId: 'AuthController.login', role: 'PRIMARY', confidence: 0.95, active: true },
    { mappingId: 'map_3', resourceId: 'AuthService.login', role: 'CORE', confidence: 0.96, active: true },
    { mappingId: 'map_4', resourceId: 'UserRepository.findByEmail', role: 'SUPPORTING', confidence: 0.9, active: true },
    { mappingId: 'map_5', resourceId: 'TokenService.generate', role: 'SUPPORTING', confidence: 0.92, active: true },
    { mappingId: 'map_6', resourceId: 'authentication tests', role: 'TEST', confidence: 0.99, active: true },
  ];

  const authRelationships = {
    outgoing: [
      {
        relationshipId: 'rel_1',
        sourceFeatureId: 'feat_auth',
        targetFeatureId: 'feat_user_mgmt',
        type: 'DEPENDS_ON',
        confidence: 0.95,
        criticality: 'HIGH',
      },
    ],
    incoming: [
      {
        relationshipId: 'rel_2',
        sourceFeatureId: 'feat_checkout',
        targetFeatureId: 'feat_auth',
        type: 'DEPENDS_ON',
        confidence: 0.9,
        criticality: 'CRITICAL',
      },
    ],
  };

  const authBehavior = {
    featureId: 'feat_auth',
    entryPoints: ['POST /login'],
    flows: [
      {
        flowId: 'flow_login',
        name: 'POST /login -> AuthController.login -> AuthService.login -> UserRepository.findByEmail -> password verification -> TokenService.generate -> response',
        type: 'STANDARD',
        isPrimary: true,
        isFailure: false,
        stepsCount: 7,
      },
    ],
    updatedAt: Date.now() - 15000,
  };

  const authHealth = {
    featureId: 'feat_auth',
    healthScore: 88,
    status: 'HEALTHY',
    verificationQuality: 'HIGH',
    criticalityScore: 70,
    criticalityLevel: 'MEDIUM',
    isStale: false,
    assessedAt: Date.now() - 5000,
    risks: [
      {
        riskId: 'risk_oauth',
        type: 'SECURITY_GAP',
        severity: 'HIGH',
        score: 75,
        description: 'missing OAuth failure verification',
        mitigation: 'Implement error handling tests for OAuth flow',
      },
    ],
  };

  const authImpact = [
    {
      featureId: 'feat_auth',
      targetId: 'feat_checkout',
      targetType: 'FEATURE',
      severity: 'HIGH',
      impactType: 'DEPENDENT_BREAKAGE',
      score: 80,
      distance: 1,
    },
  ];

  const authHistory = {
    featureId: 'feat_auth',
    firstSeenAt: Date.now() - 10000000,
    updatedAt: Date.now() - 5000,
    versionCount: 4,
    maturityLevel: 'MATURE',
    milestones: [
      { milestoneId: 'm1', title: 'feature created', timestamp: Date.now() - 10000000, importance: 'HIGH' },
      { milestoneId: 'm2', title: 'login endpoint added', timestamp: Date.now() - 8000000, importance: 'NORMAL' },
      { milestoneId: 'm3', title: 'token refresh flow added', timestamp: Date.now() - 5000000, importance: 'NORMAL' },
      { milestoneId: 'm4', title: 'health improved', timestamp: Date.now() - 1000000, importance: 'HIGH' },
    ],
    trends: [
      { trendType: 'HEALTH', direction: 'IMPROVING', description: 'Test coverage increased' },
    ],
  };

  const featureRepo = createMockFeatureRepository([authFeature]);
  const mappingRepo = createMockMappingRepository({ feat_auth: authMappings });
  const relationshipRepo = createMockRelationshipRepository({ feat_auth: authRelationships });
  const behaviorRepo = createMockBehaviorRepository({ feat_auth: authBehavior });
  const healthRepo = createMockHealthRepository({ feat_auth: authHealth });
  const impactRepo = createMockImpactRepository({ feat_auth: authImpact });
  const historyRepo = createMockHistoryRepository({ feat_auth: authHistory });

  const planner = new FeatureKnowledgePlanner();
  const freshnessResolver = new FeatureKnowledgeFreshnessResolver();
  const explainer = new FeatureKnowledgeExplainer();
  const resolver = new FeatureKnowledgeResolver({
    featureRepository: featureRepo,
    mappingRepository: mappingRepo,
    relationshipRepository: relationshipRepo,
    behaviorRepository: behaviorRepo,
    healthRepository: healthRepo,
    impactRepository: impactRepo,
    historyRepository: historyRepo,
  });
  const assembler = new FeatureKnowledgeAssembler();
  const cache = new FeatureKnowledgeCache();

  const queryService = new FeatureKnowledgeQueryService({
    planner,
    resolver,
    freshnessResolver,
    explainer,
    assembler,
    cache,
  });

  const api = new FeatureKnowledgeAPI(queryService);

  return {
    api,
    queryService,
    cache,
    repos: {
      featureRepo,
      mappingRepo,
      relationshipRepo,
      behaviorRepo,
      healthRepo,
      impactRepo,
      historyRepo,
    },
    data: {
      authFeature,
      authMappings,
      authRelationships,
      authBehavior,
      authHealth,
      authImpact,
      authHistory,
    },
  };
}
