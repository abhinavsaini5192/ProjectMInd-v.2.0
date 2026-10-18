import type {
  ILearningPolicyEngine,
  PolicyValidationResult,
} from '../interfaces/ILearningPolicyEngine.js';
import type { ScopeLevel } from '../models/LearningScope.js';
import type { LearningPolicy } from '../models/LearningPolicy.js';
import {
  DEFAULT_RESOURCE_POLICY,
  DEFAULT_PROJECT_POLICY,
  DEFAULT_GLOBAL_POLICY,
} from '../models/LearningPolicy.js';
import type { LearningCandidate, CandidateRiskLevel } from '../models/LearningCandidate.js';
import type { LearningEvaluation } from '../models/LearningEvaluation.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { LearningEventNames } from '../events/LearningEvents.js';

export class LearningPolicyEngine implements ILearningPolicyEngine {
  private readonly policies = new Map<ScopeLevel, LearningPolicy>();

  constructor(private readonly eventBus?: IEventBus | undefined) {
    this.policies.set('RESOURCE', DEFAULT_RESOURCE_POLICY);
    this.policies.set('SYMBOL', DEFAULT_RESOURCE_POLICY);
    this.policies.set('FILE', DEFAULT_RESOURCE_POLICY);
    this.policies.set('MODULE', { ...DEFAULT_RESOURCE_POLICY, scopeLevel: 'MODULE' });
    this.policies.set('FEATURE', { ...DEFAULT_PROJECT_POLICY, scopeLevel: 'FEATURE' });
    this.policies.set('TASK_TYPE', { ...DEFAULT_PROJECT_POLICY, scopeLevel: 'TASK_TYPE' });
    this.policies.set('AGENT_ROLE', { ...DEFAULT_PROJECT_POLICY, scopeLevel: 'AGENT_ROLE' });
    this.policies.set('CONTEXT_TYPE', { ...DEFAULT_PROJECT_POLICY, scopeLevel: 'CONTEXT_TYPE' });
    this.policies.set('RETRIEVAL_TYPE', { ...DEFAULT_PROJECT_POLICY, scopeLevel: 'RETRIEVAL_TYPE' });
    this.policies.set('PLAN_TYPE', { ...DEFAULT_PROJECT_POLICY, scopeLevel: 'PLAN_TYPE' });
    this.policies.set('REPOSITORY', { ...DEFAULT_PROJECT_POLICY, scopeLevel: 'REPOSITORY' });
    this.policies.set('PROJECT', DEFAULT_PROJECT_POLICY);
    this.policies.set('WORKSPACE', { ...DEFAULT_PROJECT_POLICY, scopeLevel: 'WORKSPACE', minConfidence: 0.8 });
    this.policies.set('GLOBAL', DEFAULT_GLOBAL_POLICY);
  }

  public getPolicyForScope(scopeLevel: ScopeLevel): LearningPolicy {
    return this.policies.get(scopeLevel) ?? DEFAULT_PROJECT_POLICY;
  }

  public setPolicy(policy: LearningPolicy): void {
    this.policies.set(policy.scopeLevel, policy);
  }

  public validateCandidateAgainstPolicy(
    candidate: LearningCandidate,
    evaluation: LearningEvaluation
  ): PolicyValidationResult {
    const policy = this.getPolicyForScope(candidate.scope.level);
    const violations: string[] = [];

    // 1. Confidence threshold
    if (candidate.confidence < policy.minConfidence) {
      violations.push(
        `Confidence ${candidate.confidence.toFixed(2)} is below required policy threshold ${policy.minConfidence.toFixed(2)} for scope ${policy.scopeLevel}.`
      );
    }

    // 2. Minimum evidence count
    if (candidate.evidence.length < policy.minEvidenceCount) {
      violations.push(
        `Evidence count ${candidate.evidence.length} is below policy minimum of ${policy.minEvidenceCount}.`
      );
    }

    // 3. Source diversity
    const uniqueSourceTypes = new Set(candidate.evidence.map((e) => e.sourceType)).size;
    if (uniqueSourceTypes < policy.minSourceDiversity) {
      violations.push(
        `Unique source types count ${uniqueSourceTypes} is below policy minimum of ${policy.minSourceDiversity}.`
      );
    }

    // 4. Inherent Risk check
    if (this.isRiskHigher(candidate.risk, policy.maxAllowedRisk)) {
      violations.push(
        `Candidate risk level "${candidate.risk}" exceeds maximum policy allowed risk "${policy.maxAllowedRisk}".`
      );
    }

    // 5. Bounded Adjustment magnitude check (runaway loop protection)
    const proposedDelta = Math.abs(
      candidate.proposedChange['weightAdjustment'] ??
      candidate.proposedChange['rankingScoreDelta'] ??
      candidate.proposedChange['affinityModifier'] ??
      0
    );
    if (proposedDelta > policy.maxAdjustmentMagnitude) {
      violations.push(
        `Proposed adjustment magnitude ${proposedDelta.toFixed(2)} exceeds maximum policy ceiling ${policy.maxAdjustmentMagnitude.toFixed(2)}.`
      );
    }

    // 6. Global scope protection
    if (candidate.scope.level === 'GLOBAL' && candidate.authority !== 'USER_REPORTED' && candidate.authority !== 'APPROVED') {
      violations.push(
        'GLOBAL scope requires explicit human authorization or USER_REPORTED authority.'
      );
    }

    const passed = violations.length === 0;

    if (!passed && this.eventBus) {
      this.eventBus.publish(LearningEventNames.POLICY_VIOLATED, {
        candidateId: candidate.id,
        violations,
      });
    }

    return { passed, violations };
  }

  public canAutoDeploy(candidate: LearningCandidate, evaluation: LearningEvaluation): boolean {
    const policy = this.getPolicyForScope(candidate.scope.level);
    if (!policy.allowAutomaticDeployment) return false;
    if (policy.requireExplicitApproval) return false;
    if (!evaluation.isAccepted) return false;
    if (evaluation.recommendedAction !== 'ACCEPT') return false;

    const validation = this.validateCandidateAgainstPolicy(candidate, evaluation);
    return validation.passed;
  }

  private isRiskHigher(risk: CandidateRiskLevel, maxAllowed: CandidateRiskLevel): boolean {
    const ranks: Record<CandidateRiskLevel, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };
    return (ranks[risk] ?? 1) > (ranks[maxAllowed] ?? 2);
  }
}
