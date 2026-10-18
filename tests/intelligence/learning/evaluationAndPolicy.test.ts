import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryLearningStore } from '../../../src/intelligence/learning/services/InMemoryLearningStore.js';
import { LearningEvaluator } from '../../../src/intelligence/learning/services/LearningEvaluator.js';
import { LearningPolicyEngine } from '../../../src/intelligence/learning/services/LearningPolicyEngine.js';
import type { LearningCandidate } from '../../../src/intelligence/learning/models/LearningCandidate.js';

describe('Evaluation & Policy Engine', () => {
  let store: InMemoryLearningStore;
  let evaluator: LearningEvaluator;
  let policyEngine: LearningPolicyEngine;

  beforeEach(() => {
    store = new InMemoryLearningStore();
    evaluator = new LearningEvaluator(store);
    policyEngine = new LearningPolicyEngine();
  });

  const createDummyCandidate = (overrides?: Partial<LearningCandidate>): LearningCandidate => {
    return {
      id: 'cand_test_1',
      workspaceId: 'ws_alpha',
      projectId: 'proj_beta',
      candidateType: 'CONTEXT_RESOURCE_BOOST',
      target: {
        system: 'CONTEXT',
        targetType: 'RESOURCE',
        targetId: 'src/auth/service.ts',
      },
      proposedChange: { resourceId: 'src/auth/service.ts', weightAdjustment: 0.20 },
      scope: {
        level: 'PROJECT',
        value: 'proj_beta',
        workspaceId: 'ws_alpha',
        projectId: 'proj_beta',
      },
      evidence: [
        {
          evidenceId: 'ev_1',
          sourceType: 'USER',
          description: 'User confirmed usefulness',
          value: 1.0,
          confidence: 0.95,
          timestamp: Date.now() - 1000,
          authority: 'USER_REPORTED',
          verificationPassed: true,
        },
        {
          evidenceId: 'ev_2',
          sourceType: 'VERIFICATION',
          description: 'Automated verification passed',
          value: 1.0,
          confidence: 0.90,
          timestamp: Date.now() - 2000,
          authority: 'VERIFIED',
          verificationPassed: true,
        },
        {
          evidenceId: 'ev_3',
          sourceType: 'AGENT',
          description: 'Agent requested file',
          value: 1.0,
          confidence: 0.80,
          timestamp: Date.now() - 3000,
          authority: 'AGENT_REPORTED',
        },
      ],
      confidence: 0.85,
      authority: 'USER_REPORTED',
      expectedEffect: 'Boost auth service relevance in context',
      risk: 'LOW',
      reversibility: 'FULL',
      evaluationStatus: 'PROPOSED',
      deploymentMode: 'SHADOW',
      reasoning: ['Supported by user and verification'],
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    };
  };

  it('should thoroughly evaluate candidate quality dimensions', async () => {
    const candidate = createDummyCandidate();
    const evaluation = await evaluator.evaluateCandidate(candidate);

    expect(evaluation.evaluationId).toBeDefined();
    expect(evaluation.dimensions.evidenceQuality).toBeGreaterThan(0.7);
    expect(evaluation.dimensions.sourceDiversity).toBe(1.0); // 3 distinct source types
    expect(evaluation.dimensions.consistency).toBe(1.0); // 100% positive
    expect(evaluation.dimensions.outcomeSupport).toBe(0.9); // verified evidence
    expect(evaluation.isAccepted).toBe(true);
    expect(evaluation.recommendedAction).toBe('ACCEPT');
  });

  it('should support offline shadow evaluation against baseline metrics', async () => {
    const candidate = createDummyCandidate();
    const shadowResult = await evaluator.evaluateShadow(candidate, { relevanceScore: 0.70 });

    expect(shadowResult.controlMetric).toBe(0.70);
    expect(shadowResult.candidateMetric).toBeGreaterThan(0.70);
    expect(shadowResult.relativeImprovement).toBeGreaterThan(0);
    expect(shadowResult.sampleCount).toBe(3);
  });

  it('should validate candidate against policy and pass compliant project candidate', async () => {
    const candidate = createDummyCandidate();
    const evaluation = await evaluator.evaluateCandidate(candidate);
    const result = policyEngine.validateCandidateAgainstPolicy(candidate, evaluation);

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(policyEngine.canAutoDeploy(candidate, evaluation)).toBe(true);
  });

  it('should reject candidates exceeding maximum allowed risk or adjustment magnitude', async () => {
    const highRiskCandidate = createDummyCandidate({
      risk: 'CRITICAL',
      proposedChange: { weightAdjustment: 0.85 }, // exceeds ceiling 0.25
    });
    const evaluation = await evaluator.evaluateCandidate(highRiskCandidate);
    const result = policyEngine.validateCandidateAgainstPolicy(highRiskCandidate, evaluation);

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('exceeds maximum policy allowed risk'))).toBe(true);
    expect(result.violations.some((v) => v.includes('exceeds maximum policy ceiling'))).toBe(true);
  });

  it('should enforce strict GLOBAL scope policy requiring explicit human approval', async () => {
    const globalCandidate = createDummyCandidate({
      scope: {
        level: 'GLOBAL',
        value: 'global',
        workspaceId: 'ws_alpha',
      },
      authority: 'AGENT_REPORTED', // Not user or approved
    });
    const evaluation = await evaluator.evaluateCandidate(globalCandidate);
    const result = policyEngine.validateCandidateAgainstPolicy(globalCandidate, evaluation);

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('GLOBAL scope requires explicit human authorization'))).toBe(true);
    expect(policyEngine.canAutoDeploy(globalCandidate, evaluation)).toBe(false);
  });
});
