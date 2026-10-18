import type { AgentRuntimeCheckpoint } from '../models/AgentRuntimeCheckpoint.js';

export interface RecoveryStep {
  readonly id: string;
  readonly type: 'ISOLATE_RUNTIME' | 'RESTORE_SESSIONS' | 'RECONNECT_TASKS' | 'INVALIDATE_CONTEXT' | 'FINALIZE';
  readonly description: string;
  readonly required: boolean;
}

export interface RecoveryPlan {
  readonly planId: string;
  readonly checkpointId?: string | undefined;
  readonly steps: readonly RecoveryStep[];
  readonly createdAt: string;
}

export class RuntimeRecoveryPlanner {
  public createPlan(checkpoint?: AgentRuntimeCheckpoint | undefined): RecoveryPlan {
    const planId = `rec_plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const steps: RecoveryStep[] = [
      {
        id: `${planId}_1`,
        type: 'ISOLATE_RUNTIME',
        description: 'Transition runtime into RECOVERING state and block new inbound requests',
        required: true,
      },
      {
        id: `${planId}_2`,
        type: 'RESTORE_SESSIONS',
        description: `Restore and validate ${checkpoint ? checkpoint.activeSessionIds.length : 0} session records`,
        required: true,
      },
      {
        id: `${planId}_3`,
        type: 'RECONNECT_TASKS',
        description: `Reconcile ${checkpoint ? checkpoint.activeTaskIds.length : 0} active tasks and renew leases`,
        required: true,
      },
      {
        id: `${planId}_4`,
        type: 'INVALIDATE_CONTEXT',
        description: 'Mark impacted context sessions as stale to ensure fresh context upon resume',
        required: false,
      },
      {
        id: `${planId}_5`,
        type: 'FINALIZE',
        description: 'Transition runtime state to READY and publish recovery event',
        required: true,
      },
    ];

    return {
      planId,
      checkpointId: checkpoint?.checkpointId,
      steps,
      createdAt: new Date().toISOString(),
    };
  }
}
