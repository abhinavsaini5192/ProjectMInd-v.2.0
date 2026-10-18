import { randomUUID } from 'crypto';
import type { RecoveryState, RecoveryOperation, RecoveryOperationType } from '../models/RecoveryState.js';
import type { IBackupManager } from '../../storage/recovery/BackupTypes.js';
import type { IRestoreManager, RestoreOptions, RestoreResult } from '../../storage/recovery/RestoreTypes.js';
import type { IResourceLockManager } from '../../concurrency/locking/IResourceLockManager.js';
import { BackupRestoreValidator } from './BackupRestoreValidator.js';
import { RecoveryVerifier } from '../verification/RecoveryVerifier.js';

export interface ExecuteDisasterRestoreOptions {
  readonly backupId: string;
  readonly authorizedBy: string;
  readonly targetWorkspaceId?: string | undefined;
  readonly targetRepositoryId?: string | undefined;
  readonly force?: boolean | undefined;
  readonly currentStorageVersion?: number | undefined;
  readonly correlationId?: string | undefined;
}

export class DisasterRecoveryManager {
  private currentState: RecoveryState = 'NOT_REQUIRED';
  private readonly operations = new Map<string, RecoveryOperation>();

  constructor(
    private readonly backupManager?: IBackupManager | undefined,
    private readonly restoreManager?: IRestoreManager | undefined,
    private readonly lockManager?: IResourceLockManager | undefined,
    private readonly verifier?: RecoveryVerifier | undefined
  ) {}

  public getCurrentState(): RecoveryState {
    return this.currentState;
  }

  public getOperation(operationId: string): RecoveryOperation | undefined {
    return this.operations.get(operationId);
  }

  public listOperations(): RecoveryOperation[] {
    return Array.from(this.operations.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Executes a safe, validated disaster recovery restore operation.
   * Enforces:
   * 1. Authorization
   * 2. Pre-restore validation
   * 3. Exclusive resource lock acquisition
   * 4. Restore execution
   * 5. Post-restore verification
   */
  public async executeDisasterRestore(options: ExecuteDisasterRestoreOptions): Promise<RecoveryOperation> {
    const operationId = `dr-${randomUUID()}`;
    const startedAt = Date.now();
    const scope = options.targetWorkspaceId ? `ws:${options.targetWorkspaceId}` : 'global';
    const errors: string[] = [];

    this.currentState = 'IN_PROGRESS';

    // 1. Fetch backup and validate
    const backup = this.backupManager ? await this.backupManager.inspectBackup(options.backupId) : undefined;
    const assessment = BackupRestoreValidator.validateRestore(
      {
        backupId: options.backupId,
        type: options.targetWorkspaceId ? 'SCOPED' : 'FULL',
        authorizedBy: options.authorizedBy,
        targetWorkspaceId: options.targetWorkspaceId,
        targetRepositoryId: options.targetRepositoryId,
        force: options.force,
      },
      backup,
      options.currentStorageVersion ?? 1
    );

    if (!assessment.canRestore) {
      this.currentState = 'FAILED';
      const failedOp: RecoveryOperation = {
        operationId,
        type: 'STORAGE_RESTORE',
        scope,
        status: 'FAILED',
        startedAt,
        completedAt: Date.now(),
        initiatedBy: options.authorizedBy,
        correlationId: options.correlationId,
        actions: [],
        errors: assessment.errors,
      };
      this.operations.set(operationId, failedOp);
      return failedOp;
    }

    // 2. Acquire exclusive coordination lock to prevent concurrent mutations during restore
    let lockId: string | undefined;
    const lockKey = `dr:restore:${scope}`;
    if (this.lockManager) {
      const lockRes = await this.lockManager.acquire(lockKey, `dr-${operationId}`, {
        ttlMs: 120000,
        purpose: 'disaster_restore',
      });
      if (!lockRes.success) {
        this.currentState = 'BLOCKED';
        const blockedOp: RecoveryOperation = {
          operationId,
          type: 'STORAGE_RESTORE',
          scope,
          status: 'BLOCKED',
          startedAt,
          completedAt: Date.now(),
          initiatedBy: options.authorizedBy,
          correlationId: options.correlationId,
          actions: [],
          errors: [`Could not acquire exclusive restore lock for scope '${scope}' (contended)`],
        };
        this.operations.set(operationId, blockedOp);
        return blockedOp;
      }
      lockId = lockRes.lock?.lockId;
    }

    try {
      // 3. Execute Restore
      let restoreResult: RestoreResult | undefined;
      if (this.restoreManager) {
        restoreResult = await this.restoreManager.executeRestore({
          backupId: options.backupId,
          type: options.targetWorkspaceId ? 'SCOPED' : 'FULL',
          authorizedBy: options.authorizedBy,
          targetWorkspaceId: options.targetWorkspaceId,
          targetRepositoryId: options.targetRepositoryId,
          force: options.force,
        });

        if (!restoreResult.success) {
          throw new Error(`Restore execution failed: ${restoreResult.message}`);
        }
      }

      // 4. Post-Recovery Verification
      let verification = undefined;
      if (this.verifier) {
        verification = await this.verifier.verify();
        if (!verification.isVerified) {
          errors.push(...verification.errors.map((e) => `Post-recovery verification failure: ${e}`));
        }
      }

      const finalStatus: RecoveryState = errors.length === 0 ? 'RECOVERED' : 'PARTIALLY_RECOVERED';
      this.currentState = finalStatus;

      const op: RecoveryOperation = {
        operationId,
        type: 'STORAGE_RESTORE',
        scope,
        status: finalStatus,
        startedAt,
        completedAt: Date.now(),
        initiatedBy: options.authorizedBy,
        correlationId: options.correlationId,
        recoveryPointId: options.backupId,
        actions: [
          {
            actionId: `act-restore`,
            description: `Restored backup '${options.backupId}'`,
            targetResource: scope,
            status: 'APPLIED',
            appliedAt: Date.now(),
          },
        ],
        verification,
        errors,
      };

      this.operations.set(operationId, op);
      return op;
    } catch (err) {
      this.currentState = 'FAILED';
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);

      const op: RecoveryOperation = {
        operationId,
        type: 'STORAGE_RESTORE',
        scope,
        status: 'FAILED',
        startedAt,
        completedAt: Date.now(),
        initiatedBy: options.authorizedBy,
        correlationId: options.correlationId,
        recoveryPointId: options.backupId,
        actions: [],
        errors,
      };
      this.operations.set(operationId, op);
      return op;
    } finally {
      if (lockId && this.lockManager) {
        await this.lockManager.release(lockId, `dr-${operationId}`);
      }
    }
  }
}
