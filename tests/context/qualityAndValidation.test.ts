import { describe, it, expect } from 'vitest';
import { ContextQualityEvaluator } from '../../src/context/intelligence/ContextQualityEvaluator.js';
import { ContextValidator } from '../../src/context/intelligence/ContextValidator.js';
import { ScopeViolationError } from '../../src/security/errors/SecurityError.js';
import { ContextValidationError } from '../../src/context/errors/ContextValidationError.js';
import type { ContextCandidate } from '../../src/context/models/ContextCandidate.js';
import type { TaskUnderstanding } from '../../src/context/models/TaskUnderstanding.js';
import type { ContextPackage } from '../../src/context/models/ContextPackage.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';
import { createDefaultRelevance } from '../../src/context/models/ContextRelevance.js';

describe('Phase 9.3 - Context Quality Evaluation & Context Validation', () => {
  const mockTask: TaskUnderstanding = {
    taskId: 'task_val_1',
    rawRequest: 'Fix authentication token expiry',
    normalizedRequest: 'Fix authentication token expiry',
    taskType: 'BUG_FIX',
    intent: 'DEBUG',
    targetEntities: ['AuthService.verifyToken'],
    candidateFeatures: ['feat_auth_service_001'],
    candidateResources: ['src/auth/AuthService.ts'],
    requestedAction: 'Fix token expiry',
    constraints: [],
    scope: { workspaceId: 'ws_prod', projectId: 'proj_auth', repositoryId: 'repo_backend' },
    confidence: 0.95,
    provenance: 'DETERMINISTIC_RULES',
  };

  const candidateFeature: ContextCandidate = {
    candidateId: 'cand_feat_1',
    candidateType: 'FEATURE',
    name: 'feat_auth_service_001',
    score: 0.92,
    priority: 'CRITICAL',
    dimensions: {
      taskRelevance: 0.95,
      featureRelevance: 1.0,
      architecturalRelevance: 0.85,
      dependencyRelevance: 0.8,
      behavioralRelevance: 0.8,
      changeRelevance: 0.5,
      historyRelevance: 0.6,
      riskRelevance: 0.7,
      verificationRelevance: 0.6,
      recency: 0.7,
      confidence: 0.95,
      scopeRelevance: 1.0,
    },
    primaryEvidence: 'Target authentication feature',
    estimatedTokens: 60,
  };

  const candidateFile: ContextCandidate = {
    candidateId: 'cand_file_1',
    candidateType: 'FILE',
    name: 'src/auth/AuthService.ts',
    path: 'src/auth/AuthService.ts',
    score: 0.88,
    priority: 'HIGH',
    dimensions: {
      taskRelevance: 0.9,
      featureRelevance: 0.9,
      architecturalRelevance: 0.85,
      dependencyRelevance: 0.85,
      behavioralRelevance: 0.8,
      changeRelevance: 1.0,
      historyRelevance: 0.5,
      riskRelevance: 0.6,
      verificationRelevance: 0.5,
      recency: 0.8,
      confidence: 0.9,
      scopeRelevance: 1.0,
    },
    primaryEvidence: 'Core authentication service',
    estimatedTokens: 180,
  };

  describe('ContextQualityEvaluator', () => {
    const evaluator = new ContextQualityEvaluator();

    it('evaluates all 7 quality dimensions accurately for high-quality context', () => {
      const quality = evaluator.evaluate([candidateFeature, candidateFile], mockTask, 500, 'FRESH');

      expect(quality.relevance).toBeGreaterThanOrEqual(0.85);
      expect(quality.completeness).toBe(0.95); // Both FEATURE and FILE present
      expect(quality.freshness).toBe(1.0);
      expect(quality.confidence).toBeGreaterThanOrEqual(0.9);
      expect(quality.scopeCorrectness).toBe(1.0);
      expect(quality.tokenEfficiency).toBe(0.95); // 240 <= 500
      expect(quality.explainability).toBe(1.0); // Both have primaryEvidence
      expect(quality.overallScore).toBeGreaterThanOrEqual(0.85);
      expect(quality.assessmentReasons).toBeDefined();
    });

    it('reflects reduced freshness when context is STALE', () => {
      const quality = evaluator.evaluate([candidateFeature, candidateFile], mockTask, 500, 'STALE');
      expect(quality.freshness).toBe(0.6);
      expect(quality.overallScore).toBeLessThan(0.9);
    });

    it('handles empty candidate sets safely', () => {
      const quality = evaluator.evaluate([], mockTask, 500, 'FRESH');
      expect(quality.relevance).toBe(0.1);
      expect(quality.completeness).toBe(0.1);
      expect(quality.overallScore).toBeLessThanOrEqual(0.5);
      expect(quality.assessmentReasons.empty).toBeDefined();
    });
  });

  describe('ContextValidator - Scope and Budget Enforcement', () => {
    const validator = new ContextValidator();

    const createBasePackage = (): ContextPackage => ({
      packageId: 'pkg_test_1',
      workspaceId: 'ws_prod',
      repositoryId: 'repo_backend',
      task: { text: 'Fix auth' },
      features: [],
      resources: [{
        resourceId: 'res_auth_1',
        path: 'src/auth/AuthService.ts',
        role: 'IMPLEMENTATION',
        featureId: 'feat_auth',
        relevance: createDefaultRelevance(0.9, 1.0, true, ['test']),
        priority: 'HIGH',
      }],
      behavior: [],
      dependencies: [],
      tests: [],
      history: [],
      warnings: [],
      selectionReasons: {},
      completeness: { score: 1.0, isComplete: true, missingElements: [] } as any,
      freshness: { isStale: false, status: 'FRESH' } as any,
      estimatedTokens: 300,
      generatedAt: Date.now(),
      version: { packageVersion: '1.0.0', knowledgeVersion: '1.0.0', modelVersion: '1.0.0', generationTimestamp: Date.now(), isConsistent: true, mismatchedSubsystems: [] },
    });

    it('allows valid package matching requested workspace and project', () => {
      const pkg = createBasePackage();
      const request: ContextRequest = {
        workspaceId: 'ws_prod',
        projectId: 'proj_auth',
        repositoryId: 'repo_backend',
        taskText: 'Fix auth',
        securityContext: {
          workspaceId: 'ws_prod',
          projectId: 'proj_auth',
          isGlobalAdmin: () => false,
        } as any,
      };

      expect(() => validator.validate(pkg, request)).not.toThrow();
    });

    it('rejects cross-workspace request with ScopeViolationError', () => {
      const pkg = createBasePackage();
      const request: ContextRequest = {
        workspaceId: 'ws_other_unauthorized',
        projectId: 'proj_auth',
        repositoryId: 'repo_backend',
        taskText: 'Fix auth',
        securityContext: {
          workspaceId: 'ws_prod',
          projectId: 'proj_auth',
          isGlobalAdmin: () => false,
        } as any,
      };

      expect(() => validator.validate(pkg, request)).toThrow(ScopeViolationError);
      expect(() => validator.validate(pkg, request)).toThrow(/Cross-workspace violation/);
    });

    it('rejects cross-project request with ScopeViolationError', () => {
      const pkg = createBasePackage();
      const request: ContextRequest = {
        workspaceId: 'ws_prod',
        projectId: 'proj_secret_payroll',
        repositoryId: 'repo_backend',
        taskText: 'Fix auth',
        securityContext: {
          workspaceId: 'ws_prod',
          projectId: 'proj_auth',
          isGlobalAdmin: () => false,
        } as any,
      };

      expect(() => validator.validate(pkg, request)).toThrow(ScopeViolationError);
      expect(() => validator.validate(pkg, request)).toThrow(/Cross-project violation/);
    });

    it('enforces token budget limits and throws ContextValidationError on overflow', () => {
      const pkg = createBasePackage();
      pkg.estimatedTokens = 2500;

      const request: ContextRequest = {
        workspaceId: 'ws_prod',
        projectId: 'proj_auth',
        repositoryId: 'repo_backend',
        taskText: 'Fix auth',
        tokenBudget: 1000,
      };

      expect(() => validator.validate(pkg, request)).toThrow(ContextValidationError);
      expect(() => validator.validate(pkg, request)).toThrow(/exceeded configured budget limit/);
    });

    it('detects duplicate resources and appends warning without crashing', () => {
      const pkg = createBasePackage();
      pkg.resources = [
        {
          resourceId: 'res_auth_1',
          path: 'src/auth/AuthService.ts',
          role: 'IMPLEMENTATION',
          featureId: 'feat_auth',
          relevance: createDefaultRelevance(0.9, 1.0, true, ['test']),
          priority: 'HIGH',
        },
        {
          resourceId: 'res_auth_1',
          path: 'src/auth/AuthService.ts',
          role: 'IMPLEMENTATION',
          featureId: 'feat_auth',
          relevance: createDefaultRelevance(0.9, 1.0, true, ['test']),
          priority: 'HIGH',
        },
      ];

      const request: ContextRequest = {
        workspaceId: 'ws_prod',
        projectId: 'proj_auth',
        repositoryId: 'repo_backend',
        taskText: 'Fix auth',
      };

      validator.validate(pkg, request);
      expect(pkg.warnings.some((w) => w.type === 'DUPLICATE_RESOURCE')).toBe(true);
    });
  });
});
