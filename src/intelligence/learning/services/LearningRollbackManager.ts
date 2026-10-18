import { createHash } from 'node:crypto';
import type { ILearningRollbackManager } from '../interfaces/ILearningRollbackManager.js';
import type { ILearningStore } from '../interfaces/ILearningStore.js';
import type { LearningRollback } from '../models/LearningRollback.js';
import type { DeployedLearning } from '../models/DeployedLearning.js';
import { RollbackError } from '../errors/LearningError.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { LearningEventNames } from '../events/LearningEvents.js';

export class LearningRollbackManager implements ILearningRollbackManager {
  constructor(
    private readonly store: ILearningStore,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async rollbackLearning(
    deployedLearningId: string,
    reason: string,
    actor: string
  ): Promise<LearningRollback> {
    if (!reason || reason.trim().length === 0) {
      throw new RollbackError('A clear justification reason is required to execute a rollback.');
    }

    const deployed = await this.store.getDeployed(deployedLearningId);
    if (!deployed) {
      throw new RollbackError(`Deployed learning "${deployedLearningId}" not found.`);
    }

    if (deployed.status === 'ROLLED_BACK') {
      throw new RollbackError(`Deployed learning "${deployedLearningId}" has already been rolled back.`);
    }

    const now = Date.now();
    const rollbackId = `rb_${now}_${createHash('sha256').update(deployedLearningId + reason).digest('hex').slice(0, 8)}`;

    // Mark current as ROLLED_BACK
    const rolledBackDeployed: DeployedLearning = {
      ...deployed,
      status: 'ROLLED_BACK',
      rollbackId,
    };
    await this.store.updateDeployed(rolledBackDeployed);

    // If there was a previous version, restore it to ACTIVE
    let restoredState: Record<string, any> | undefined;
    if (deployed.previousVersionId) {
      const prev = await this.store.getDeployed(deployed.previousVersionId);
      if (prev && prev.status === 'SUPERSEDED') {
        const reactivated: DeployedLearning = {
          ...prev,
          status: 'ACTIVE',
        };
        await this.store.updateDeployed(reactivated);
        restoredState = { restoredVersionId: prev.id, restoredVersionNumber: prev.version };
      }
    }

    // Update candidate if present
    const candidate = await this.store.getCandidate(deployed.candidateId);
    if (candidate) {
      await this.store.updateCandidate({
        ...candidate,
        evaluationStatus: 'ROLLED_BACK',
        deploymentMode: 'DISABLED',
        updatedAt: now,
      });
    }

    const rollback: LearningRollback = {
      id: rollbackId,
      deployedLearningId,
      candidateId: deployed.candidateId,
      reason,
      initiatedBy: actor,
      timestamp: now,
      restoredState,
      auditNote: `Rollback of learning ${deployedLearningId} (version ${deployed.version}) executed by ${actor}. Justification: ${reason}`,
    };

    await this.store.saveRollback(rollback);

    if (this.eventBus) {
      this.eventBus.publish(LearningEventNames.ROLLED_BACK, {
        rollback,
        previousState: deployed.appliedChange,
      });
    }

    return rollback;
  }

  public async getRollbackHistory(deployedLearningId?: string): Promise<LearningRollback[]> {
    return this.store.getRollbacks(deployedLearningId);
  }
}
