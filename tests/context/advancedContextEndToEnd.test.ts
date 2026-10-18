import { describe, it, expect } from 'vitest';
import { createTestOrchestrator, AUTH_FEATURE_ID, CHECKOUT_FEATURE_ID } from './ContextTestHelper.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';

describe('Phase 9.3 - Advanced Context Intelligence End-to-End & Regression Suite', () => {
  const orchestrator = createTestOrchestrator();

  describe('Section 43: Complete End-to-End Pipeline Scenario', () => {
    it('executes full pipeline for "Fix the authentication timeout."', async () => {
      const request: ContextRequest = {
        workspaceId: 'ws_mind',
        projectId: 'proj_auth_system',
        repositoryId: 'repo_mind',
        taskText: 'Fix the authentication timeout in AuthService',
        tokenBudget: 3500,
        compressionMode: 'COMPACT',
        includeDependencies: true,
        includeBehavior: true,
        includeHealth: true,
        explainSelection: true,
      };

      // 1. Task Understanding & Classification
      const taskUnderstanding = await orchestrator.understandTask(request);
      expect(taskUnderstanding).toBeDefined();
      expect(taskUnderstanding.taskType).toBe('DEBUGGING');
      expect(taskUnderstanding.intent).toBe('DEBUG');
      expect(taskUnderstanding.candidateFeatures).toContain('authentication');
      expect(taskUnderstanding.confidence).toBeGreaterThanOrEqual(0.7);

      // 2. Full Orchestration Pipeline: Task Understanding -> Candidate Generation ->
      //    Relevance Evaluation -> Expansion -> Compression -> Token Budgeting -> Validation
      const result = await orchestrator.orchestrateContext(request);
      expect(result.success).toBe(true);

      const pkg = result.package;
      expect(pkg).toBeDefined();
      expect(pkg.packageId).toBeDefined();

      // 3. Feature Resolution: Authentication Service is DIRECT target
      const authFeature = pkg.features.find((f) => f.featureId === AUTH_FEATURE_ID);
      expect(authFeature).toBeDefined();
      expect(authFeature!.role).toBe('DIRECT');

      // 4. Candidate Resources Selection
      const authFile = pkg.resources.find((r) => r.filePath === 'src/auth/AuthService.ts');
      expect(authFile).toBeDefined();
      expect(authFile!.priority).toBe('CRITICAL');

      // 5. Behavior & Risk Integration
      expect(pkg.behavior).toBeDefined();
      expect(pkg.health).toBeDefined();

      // 6. Context Quality Assessment
      expect(pkg.quality).toBeDefined();
      expect(pkg.quality!.relevance).toBeGreaterThanOrEqual(0.7);
      expect(pkg.quality!.completeness).toBeGreaterThanOrEqual(0.7);
      expect(pkg.quality!.freshness).toBe(1.0);
      expect(pkg.quality!.scopeCorrectness).toBe(1.0);
      expect(pkg.quality!.tokenEfficiency).toBeGreaterThanOrEqual(0.9);
      expect(pkg.quality!.explainability).toBeGreaterThanOrEqual(0.8);

      // 7. Context Explanations & Meaningful Exclusions
      expect(result.explanations).toBeDefined();
      expect(result.explanations!.taskAnalysisSummary).toContain('Fix the authentication timeout');
      expect(pkg.exclusions).toBeDefined();

      // 8. Token Budget Enforcement
      expect(pkg.estimatedTokens).toBeLessThanOrEqual(3500);

      // 9. Source Fragment Selection under COMPACT mode
      expect(pkg.sourceFragments).toBeDefined();
    });
  });

  describe('Section 44: Context Quality Regression Scenarios', () => {
    interface QualityScenario {
      name: string;
      request: ContextRequest;
      expectedTaskType: string;
      expectedIntent: string;
      expectedFeatures: string[];
      excludedFeatures: string[];
      maxBudget: number;
    }

    const scenarios: QualityScenario[] = [
      {
        name: 'Scenario A: Bug Fix / Debugging Authentication',
        request: {
          workspaceId: 'ws_mind',
          projectId: 'proj_auth',
          repositoryId: 'repo_mind',
          taskText: 'Fix login token expiration bug in authentication handler',
          tokenBudget: 3000,
        },
        expectedTaskType: 'BUG_FIX',
        expectedIntent: 'DEBUG',
        expectedFeatures: [AUTH_FEATURE_ID],
        excludedFeatures: [],
        maxBudget: 3000,
      },
      {
        name: 'Scenario B: Implementation for Checkout / Payment',
        request: {
          workspaceId: 'ws_mind',
          projectId: 'proj_shop',
          repositoryId: 'repo_mind',
          taskText: 'Add new payment gateway integration for credit card checkout',
          tokenBudget: 2500,
        },
        expectedTaskType: 'IMPLEMENTATION',
        expectedIntent: 'ADD',
        expectedFeatures: [CHECKOUT_FEATURE_ID],
        excludedFeatures: [],
        maxBudget: 2500,
      },
      {
        name: 'Scenario C: Explanation / Investigation of Auth Failure',
        request: {
          workspaceId: 'ws_mind',
          projectId: 'proj_auth',
          repositoryId: 'repo_mind',
          taskText: 'Explain why user authentication returns 401 unauthorized',
          tokenBudget: 2000,
        },
        expectedTaskType: 'INVESTIGATION',
        expectedIntent: 'INVESTIGATE',
        expectedFeatures: [AUTH_FEATURE_ID],
        excludedFeatures: [],
        maxBudget: 2000,
      },
    ];

    for (const sc of scenarios) {
      it(`evaluates ${sc.name} consistently`, async () => {
        const understood = await orchestrator.understandTask(sc.request);
        expect(understood.taskType).toBe(sc.expectedTaskType);
        expect(understood.intent).toBe(sc.expectedIntent);

        const result = await orchestrator.orchestrateContext(sc.request);
        expect(result.success).toBe(true);

        const pkg = result.package;
        // Verify expected features resolved
        for (const featId of sc.expectedFeatures) {
          expect(pkg.features.some((f) => f.featureId === featId)).toBe(true);
        }

        // Verify budget strictly honored
        expect(pkg.estimatedTokens).toBeLessThanOrEqual(sc.maxBudget);

        // Quality assessment verified
        expect(pkg.quality).toBeDefined();
        expect(pkg.quality!.overallScore).toBeGreaterThanOrEqual(0.65);
      });
    }

    it('Scenario D: Strict low budget forces progressive expansion cutoff and tracks exclusions', async () => {
      const lowBudgetRequest: ContextRequest = {
        workspaceId: 'ws_mind',
        projectId: 'proj_auth',
        repositoryId: 'repo_mind',
        taskText: 'Fix authentication service timeout',
        tokenBudget: 200, // Very tight token budget
        explainSelection: true,
      };

      const result = await orchestrator.orchestrateContext(lowBudgetRequest);
      expect(result.success).toBe(true);

      const pkg = result.package;
      expect(pkg.estimatedTokens).toBeLessThanOrEqual(220); // within tolerance
      expect(pkg.exclusions?.length).toBeGreaterThan(0);
      const budgetExclusion = pkg.exclusions?.find((e) => e.stage === 'TOKEN_BUDGET');
      expect(budgetExclusion).toBeDefined();
    });
  });
});
