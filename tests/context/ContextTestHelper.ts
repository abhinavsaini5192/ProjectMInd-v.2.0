import type { IFeatureKnowledgeAPI } from '../../src/knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureKnowledgeResponse } from '../../src/knowledge/features/api/models/FeatureKnowledgeResponse.js';
import type { IFeatureRepository } from '../../src/knowledge/features/interfaces/IFeatureRepository.js';
import type { IFeatureMappingRepository } from '../../src/knowledge/features/mapping/interfaces/IFeatureMappingRepository.js';
import { ContextRetrievalCoordinator } from '../../src/context/retrieval/ContextRetrievalCoordinator.js';
import { ContextOrchestrator } from '../../src/context/orchestrator/ContextOrchestrator.js';

export const AUTH_FEATURE_ID = 'feat_auth_service_001';
export const CHECKOUT_FEATURE_ID = 'feat_checkout_service_002';

export function createMockAuthFeature(): FeatureKnowledgeResponse {
  return {
    success: true,
    profile: {
      featureId: AUTH_FEATURE_ID,
      identity: {
        status: 'COMPLETE',
        itemCount: 1,
        confidence: 0.95,
        data: {
          id: AUTH_FEATURE_ID,
          name: 'Authentication Service',
          description: 'Handles user authentication, login, tokens, password reset, and sessions.',
          type: 'SERVICE',
          status: 'ACTIVE',
        },
      },
      mappings: {
        status: 'COMPLETE',
        itemCount: 3,
        confidence: 0.95,
        data: {
          mappings: [
            {
              mappingId: 'map-auth-1',
              resourceId: 'src/auth/AuthService.ts',
              role: 'PRIMARY',
              confidence: 0.95,
              active: true,
              metadata: { filePath: 'src/auth/AuthService.ts', symbolName: 'AuthService.login' },
            },
            {
              mappingId: 'map-auth-2',
              resourceId: 'src/auth/tokenUtil.ts',
              role: 'SECONDARY',
              confidence: 0.9,
              active: true,
              metadata: { filePath: 'src/auth/tokenUtil.ts' },
            },
            {
              mappingId: 'map-auth-3',
              resourceId: 'tests/auth/login.test.ts',
              role: 'TEST',
              confidence: 0.9,
              active: true,
              metadata: { filePath: 'tests/auth/login.test.ts' },
            },
          ],
          primaryResources: ['src/auth/AuthService.ts'],
          totalMapped: 3,
        },
      },
      dependencies: {
        status: 'COMPLETE',
        itemCount: 1,
        confidence: 0.85,
        data: {
          dependencies: [
            {
              featureId: CHECKOUT_FEATURE_ID,
              relationshipType: 'OPTIONAL',
              confidence: 0.8,
              direct: true,
            },
          ],
          dependents: [],
          relationshipCount: 1,
        },
      },
      behavior: {
        status: 'COMPLETE',
        itemCount: 1,
        confidence: 0.9,
        data: {
          entryPoints: ['AuthService.login', 'POST /api/login'],
          primaryFlows: [
            {
              flowId: 'flow-auth-login',
              name: 'User Login Flow',
              type: 'AUTHENTICATION',
              isPrimary: true,
              isFailure: false,
              stepsCount: 4,
              entryPoint: 'AuthService.login',
            },
          ],
          failureFlows: [],
          allFlows: [],
        },
      },
      health: {
        status: 'COMPLETE',
        itemCount: 1,
        confidence: 0.9,
        data: {
          healthScore: 0.92,
          healthStatus: 'HEALTHY',
          criticalityScore: 0.85,
          criticalityLevel: 'CRITICAL',
          risks: [
            {
              riskId: 'risk-auth-1',
              type: 'SECURITY',
              severity: 'HIGH',
              score: 0.8,
              description: 'Token expiration timeout configuration',
            },
          ],
        },
      },
      impact: {
        status: 'COMPLETE',
        itemCount: 1,
        confidence: 0.9,
        data: {
          impactRadius: 2,
          impactScore: 0.75,
          impactedFeatures: [
            {
              targetId: CHECKOUT_FEATURE_ID,
              targetType: 'FEATURE',
              severity: 'MEDIUM',
              impactType: 'DEPENDENCY_CHANGE',
              score: 0.7,
              distance: 1,
            },
          ],
          impactedResources: [
            {
              targetId: 'src/auth/AuthService.ts',
              targetType: 'RESOURCE',
              severity: 'HIGH',
              impactType: 'DIRECT_MODIFICATION',
              score: 0.9,
              distance: 0,
            },
          ],
          propagationPathsCount: 1,
        },
      },
      history: {
        status: 'COMPLETE',
        itemCount: 1,
        confidence: 0.9,
        data: {
          firstSeenAt: 1600000000,
          lastUpdatedAt: 1700000000,
          versionCount: 5,
          maturityLevel: 'STABLE',
          milestones: [
            {
              milestoneId: 'm-auth-1',
              milestoneType: 'SECURITY_PATCH',
              title: 'OAuth2 Support and Timeout Tuning',
              description: 'Configured login session timeout and oauth',
              timestamp: 1700000000,
              importance: 'HIGH',
            },
          ],
          trends: [],
          recentEventsCount: 2,
          regressionsCount: 0,
        },
      },
      architecture: {
        status: 'COMPLETE',
        itemCount: 1,
        confidence: 0.9,
        data: {
          layer: 'CORE_SERVICE',
          boundary: 'SECURITY_DOMAIN',
        },
      },
      summary: {
        status: 'COMPLETE',
        itemCount: 1,
        confidence: 0.9,
        data: {
          overview: 'Authentication system for ProjectMind',
        },
      },
      explanations: {},
      references: [],
      completeness: {
        level: 'FULL',
        overallScore: 0.95,
        sectionScores: {},
        missingSections: [],
      },
      confidence: {
        overallScore: 0.92,
        level: 'VERY_HIGH',
        sectionConfidences: {},
        factors: [],
        limitations: [],
      },
      freshness: {
        status: 'CURRENT',
        lastUpdatedAt: Date.now() - 1000,
      },
    },
    metadata: {
      requestId: 'mock-req-1',
      generatedAt: Date.now(),
      durationMs: 15,
      workspaceId: 'ws-mock',
      repositoryId: 'repo-mock',
      knowledgeVersion: '1.0.0',
      freshness: { status: 'CURRENT' },
      versionStatus: { isConsistent: true, knowledgeVersion: '1.0.0', mismatchedSubsystems: [] },
    } as any,
  } as any;
}

export function createMockCheckoutFeature(): FeatureKnowledgeResponse {
  return {
    success: true,
    profile: {
      featureId: CHECKOUT_FEATURE_ID,
      identity: {
        status: 'COMPLETE',
        itemCount: 1,
        data: {
          id: CHECKOUT_FEATURE_ID,
          name: 'Checkout Service',
          description: 'Manages user cart checkout, billing calculations, and payments.',
          type: 'SERVICE',
          status: 'ACTIVE',
        },
      },
      mappings: {
        status: 'COMPLETE',
        itemCount: 1,
        data: {
          mappings: [
            {
              mappingId: 'map-chk-1',
              resourceId: 'src/checkout/CheckoutService.ts',
              role: 'PRIMARY',
              confidence: 0.9,
              active: true,
              metadata: { filePath: 'src/checkout/CheckoutService.ts' },
            },
          ],
          primaryResources: ['src/checkout/CheckoutService.ts'],
          totalMapped: 1,
        },
      },
      dependencies: {
        status: 'COMPLETE',
        itemCount: 0,
        data: {
          dependencies: [],
          dependents: [],
          relationshipCount: 0,
        },
      },
      behavior: {
        status: 'COMPLETE',
        itemCount: 1,
        data: {
          entryPoints: ['CheckoutService.processOrder'],
          primaryFlows: [
            {
              flowId: 'flow-chk-process',
              name: 'Order Processing Flow',
              type: 'TRANSACTION',
              isPrimary: true,
              isFailure: false,
              stepsCount: 5,
            },
          ],
          failureFlows: [],
          allFlows: [],
        },
      },
      health: {
        status: 'COMPLETE',
        itemCount: 0,
        data: {
          healthScore: 0.95,
          healthStatus: 'HEALTHY',
          criticalityScore: 0.7,
          criticalityLevel: 'HIGH',
          risks: [],
        },
      },
      impact: {
        status: 'COMPLETE',
        itemCount: 0,
        data: {
          impactRadius: 1,
          impactScore: 0.4,
          impactedFeatures: [],
          impactedResources: [],
          propagationPathsCount: 0,
        },
      },
      history: {
        status: 'COMPLETE',
        itemCount: 0,
        data: {
          firstSeenAt: 1650000000,
          lastUpdatedAt: 1700000000,
          versionCount: 2,
          maturityLevel: 'STABLE',
          milestones: [],
          trends: [],
          recentEventsCount: 0,
          regressionsCount: 0,
        },
      },
      architecture: {
        status: 'COMPLETE',
        itemCount: 1,
        data: { layer: 'SERVICE' },
      },
      summary: {
        status: 'COMPLETE',
        itemCount: 1,
        data: { overview: 'Checkout management' },
      },
      explanations: {},
      references: [],
      completeness: {
        level: 'FULL',
        overallScore: 0.9,
        sectionScores: {},
        missingSections: [],
      },
      confidence: {
        overallScore: 0.9,
        level: 'HIGH',
        sectionConfidences: {},
        factors: [],
        limitations: [],
      },
      freshness: {
        status: 'CURRENT',
        lastUpdatedAt: Date.now() - 2000,
      },
    },
    metadata: {
      requestId: 'mock-req-2',
      generatedAt: Date.now(),
      durationMs: 10,
      workspaceId: 'ws-mock',
      repositoryId: 'repo-mock',
      knowledgeVersion: '1.0.0',
      freshness: { status: 'CURRENT' },
      versionStatus: { isConsistent: true, knowledgeVersion: '1.0.0', mismatchedSubsystems: [] },
    } as any,
  } as any;
}

export function createMockFeatureKnowledgeApi(): IFeatureKnowledgeAPI {
  const auth = createMockAuthFeature();
  const chk = createMockCheckoutFeature();

  return {
    async getFeatureKnowledge(queryOrId: any): Promise<FeatureKnowledgeResponse> {
      const id = typeof queryOrId === 'string' ? queryOrId : queryOrId.featureId;
      if (id === AUTH_FEATURE_ID) return auth;
      if (id === CHECKOUT_FEATURE_ID) return chk;
      return {
        success: false,
        profile: {} as any,
        metadata: {} as any,
        errors: [{ code: 'NOT_FOUND', message: `Feature '${id}' not found.` }],
      };
    },
    async getFeatureProfile(featureId: string): Promise<FeatureKnowledgeResponse> {
      return this.getFeatureKnowledge(featureId);
    },
    async getFeatureSummary(): Promise<any> {
      return {};
    },
    async getFeatureMappings(featureId: string): Promise<any> {
      return (await this.getFeatureKnowledge(featureId)).profile.mappings;
    },
    async getFeatureDependencies(featureId: string): Promise<any> {
      return (await this.getFeatureKnowledge(featureId)).profile.dependencies;
    },
    async getFeatureDependents(featureId: string): Promise<any> {
      return (await this.getFeatureKnowledge(featureId)).profile.dependencies;
    },
    async getFeatureBehavior(featureId: string): Promise<any> {
      return (await this.getFeatureKnowledge(featureId)).profile.behavior;
    },
    async getFeatureHealth(featureId: string): Promise<any> {
      return (await this.getFeatureKnowledge(featureId)).profile.health;
    },
    async getFeatureImpact(featureId: string): Promise<any> {
      return (await this.getFeatureKnowledge(featureId)).profile.impact;
    },
    async getFeatureHistory(featureId: string): Promise<any> {
      return (await this.getFeatureKnowledge(featureId)).profile.history;
    },
    async getFeatureArchitecture(featureId: string): Promise<any> {
      return (await this.getFeatureKnowledge(featureId)).profile.architecture;
    },
    async getFeatureContext(): Promise<any> {
      return {};
    },
    async explainFeatureKnowledge(): Promise<any> {
      return {};
    },
    async getKnowledgeCompleteness(): Promise<any> {
      return {};
    },
    async getKnowledgeFreshness(): Promise<any> {
      return {};
    },
    async getKnowledgeVersionStatus(): Promise<any> {
      return {};
    },
  };
}

export function createMockRepositories(): {
  featureRepository: IFeatureRepository;
  mappingRepository: IFeatureMappingRepository;
} {
  const featureRepository: IFeatureRepository = {
    async create() {},
    async get(id: string) {
      if (id === AUTH_FEATURE_ID) {
        return {
          id: AUTH_FEATURE_ID,
          featureId: AUTH_FEATURE_ID,
          name: 'Authentication Service',
          description: 'Handles user authentication, login, tokens, password reset, and sessions.',
          type: 'SERVICE' as any,
          status: 'ACTIVE' as any,
          origin: 'MANUAL' as any,
          confidence: { score: 0.95 } as any,
          scope: {} as any,
          metadata: { tags: ['auth', 'login', 'security'] },
          references: [{ resourceId: 'src/auth/AuthService.ts' } as any],
          relationships: [],
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
      if (id === CHECKOUT_FEATURE_ID) {
        return {
          id: CHECKOUT_FEATURE_ID,
          featureId: CHECKOUT_FEATURE_ID,
          name: 'Checkout Service',
          description: 'Manages user cart checkout, billing calculations, and payments.',
          type: 'SERVICE' as any,
          status: 'ACTIVE' as any,
          origin: 'MANUAL' as any,
          confidence: { score: 0.90 } as any,
          scope: {} as any,
          metadata: { tags: ['checkout', 'payment', 'billing'] },
          references: [{ resourceId: 'src/checkout/CheckoutService.ts' } as any],
          relationships: [],
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
      return null;
    },
    async update() {},
    async delete() {
      return true;
    },
    async exists(id: string) {
      return id === AUTH_FEATURE_ID || id === CHECKOUT_FEATURE_ID;
    },
    async list() {
      const f1 = await this.get(AUTH_FEATURE_ID);
      const f2 = await this.get(CHECKOUT_FEATURE_ID);
      return [f1, f2].filter(Boolean) as any[];
    },
    async findByName(name: string) {
      const lower = name.toLowerCase();
      if (lower.includes('auth') || lower.includes('login')) {
        const f = await this.get(AUTH_FEATURE_ID);
        return f ? [f] : [];
      }
      if (lower.includes('checkout') || lower.includes('payment') || lower.includes('billing')) {
        const f = await this.get(CHECKOUT_FEATURE_ID);
        return f ? [f] : [];
      }
      return [];
    },
    async findByReference(resId: string) {
      if (resId.includes('auth')) {
        const f = await this.get(AUTH_FEATURE_ID);
        return f ? [f] : [];
      }
      return [];
    },
    async findByType() {
      return [];
    },
    async findByStatus() {
      return [];
    },
  };

  const mappingRepository: IFeatureMappingRepository = {
    async save() {},
    async update() {},
    async get() {
      return null;
    },
    async getMappings() {
      return [];
    },
    async getMappingsByRole() {
      return [];
    },
    async getResourceFeatures(resourceId: string) {
      if (resourceId.includes('AuthService') || resourceId.includes('auth')) {
        return [AUTH_FEATURE_ID];
      }
      if (resourceId.includes('CheckoutService') || resourceId.includes('checkout')) {
        return [CHECKOUT_FEATURE_ID];
      }
      return [];
    },
    async deactivate() {},
    async queryConflicts() {
      return [];
    },
    async saveConflict() {},
    async getAll() {
      return [];
    },
  };

  return { featureRepository, mappingRepository };
}

export function createTestOrchestrator(): ContextOrchestrator {
  const api = createMockFeatureKnowledgeApi();
  const { featureRepository, mappingRepository } = createMockRepositories();
  const retriever = new ContextRetrievalCoordinator(api, featureRepository, mappingRepository);
  return new ContextOrchestrator(
    retriever,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    api
  );
}
