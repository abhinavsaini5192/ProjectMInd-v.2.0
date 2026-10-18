import { createHash } from 'node:crypto';
import type { ILearningDeploymentManager } from '../interfaces/ILearningDeploymentManager.js';
import type { ILearningStore } from '../interfaces/ILearningStore.js';
import type { ILearningPolicyEngine } from '../interfaces/ILearningPolicyEngine.js';
import type { DeployedLearning } from '../models/DeployedLearning.js';
import {
  CandidateNotFoundError,
  DeploymentError,
  PolicyViolationError,
} from '../errors/LearningError.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { LearningEventNames } from '../events/LearningEvents.js';

export class LearningDeploymentManager implements ILearningDeploymentManager {
  constructor(
    private readonly store: ILearningStore,
    private readonly policyEngine: ILearningPolicyEngine,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async deployCandidate(candidateId: string, actor: string): Promise<DeployedLearning> {
    const candidate = await this.store.getCandidate(candidateId);
    if (!candidate) {
      throw new CandidateNotFoundError(candidateId);
    }

    const evaluation = await this.store.getEvaluation(candidateId);
    if (!evaluation) {
      throw new DeploymentError(
        `Cannot deploy candidate "${candidateId}": it has not been evaluated.`
      );
    }

    // Policy check
    const policyResult = this.policyEngine.validateCandidateAgainstPolicy(candidate, evaluation);
    if (!policyResult.passed) {
      throw new PolicyViolationError(
        `Policy violations prevent deployment of candidate "${candidateId}": ${policyResult.violations.join('; ')}`
      );
    }

    // Check for existing active deployed learnings for the exact same target
    const existing = await this.store.queryDeployed({
      workspaceId: candidate.workspaceId,
      projectId: candidate.projectId,
      targetSystem: candidate.target.system,
      status: ['ACTIVE'],
    });

    const conflictingActive = existing.find(
      (d) => d.target.targetId === candidate.target.targetId && d.target.targetType === candidate.target.targetType
    );

    let version = 1;
    let previousVersionId: string | undefined;

    if (conflictingActive) {
      version = conflictingActive.version + 1;
      previousVersionId = conflictingActive.id;

      // Supersede previous version
      const superseded: DeployedLearning = {
        ...conflictingActive,
        status: 'SUPERSEDED',
      };
      await this.store.updateDeployed(superseded);
    }

    const now = Date.now();
    const deployedId = `dep_${now}_${createHash('sha256').update(candidateId + version).digest('hex').slice(0, 8)}`;

    const deployed: DeployedLearning = {
      id: deployedId,
      candidateId: candidate.id,
      version,
      target: candidate.target,
      appliedChange: candidate.proposedChange,
      scope: candidate.scope,
      deployedAt: now,
      deployedBy: actor,
      status: 'ACTIVE',
      previousVersionId,
      evaluationId: evaluation.evaluationId,
      metadata: {
        candidateType: candidate.candidateType,
        expectedEffect: candidate.expectedEffect,
      },
    };

    // Save deployed record
    await this.store.saveDeployed(deployed);

    // Update candidate status
    const updatedCandidate = {
      ...candidate,
      evaluationStatus: 'DEPLOYED' as const,
      deploymentMode: 'ACTIVE' as const,
      updatedAt: now,
    };
    await this.store.updateCandidate(updatedCandidate);

    if (this.eventBus) {
      this.eventBus.publish(LearningEventNames.DEPLOYED, { deployedLearning: deployed });
    }

    return deployed;
  }

  public async disableLearning(deployedLearningId: string, actor: string): Promise<DeployedLearning> {
    const deployed = await this.store.getDeployed(deployedLearningId);
    if (!deployed) {
      throw new DeploymentError(`Deployed learning "${deployedLearningId}" not found.`);
    }

    const updated: DeployedLearning = {
      ...deployed,
      status: 'DISABLED',
      metadata: {
        ...deployed.metadata,
        disabledBy: actor,
        disabledAt: Date.now(),
      },
    };

    await this.store.updateDeployed(updated);

    if (this.eventBus) {
      this.eventBus.publish(LearningEventNames.DISABLED, { deployedLearning: updated });
    }

    return updated;
  }

  public async getActiveLearnings(workspaceId: string, projectId?: string): Promise<DeployedLearning[]> {
    return this.store.queryDeployed({
      workspaceId,
      projectId,
      status: ['ACTIVE'],
    });
  }
}
