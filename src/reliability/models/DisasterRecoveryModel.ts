export type DisasterRecoveryLevel =
  | 'LEVEL_1_PROCESS_RESTART'
  | 'LEVEL_2_WORKER_RESTART'
  | 'LEVEL_3_SERVICE_INSTANCE_FAILURE'
  | 'LEVEL_4_DEPENDENCY_OUTAGE'
  | 'LEVEL_5_STORAGE_RECOVERY'
  | 'LEVEL_6_FULL_APPLICATION_RECOVERY'
  | 'LEVEL_7_DISASTER_RESTORE';

export interface RecoveryObjective {
  readonly level: DisasterRecoveryLevel;
  readonly rpoTargetMinutes: number; // Target Recovery Point Objective
  readonly rtoTargetMinutes: number; // Target Recovery Time Objective
  readonly rpoVerifiedMinutes?: number | undefined; // Measured in validation drill
  readonly rtoVerifiedMinutes?: number | undefined; // Measured in validation drill
  readonly automated: boolean;
  readonly requiresHumanApproval: boolean;
}

export const CANONICAL_RECOVERY_OBJECTIVES: Record<DisasterRecoveryLevel, RecoveryObjective> = {
  LEVEL_1_PROCESS_RESTART: {
    level: 'LEVEL_1_PROCESS_RESTART',
    rpoTargetMinutes: 0,
    rtoTargetMinutes: 1,
    automated: true,
    requiresHumanApproval: false,
  },
  LEVEL_2_WORKER_RESTART: {
    level: 'LEVEL_2_WORKER_RESTART',
    rpoTargetMinutes: 0,
    rtoTargetMinutes: 2,
    automated: true,
    requiresHumanApproval: false,
  },
  LEVEL_3_SERVICE_INSTANCE_FAILURE: {
    level: 'LEVEL_3_SERVICE_INSTANCE_FAILURE',
    rpoTargetMinutes: 0,
    rtoTargetMinutes: 5,
    automated: true,
    requiresHumanApproval: false,
  },
  LEVEL_4_DEPENDENCY_OUTAGE: {
    level: 'LEVEL_4_DEPENDENCY_OUTAGE',
    rpoTargetMinutes: 0,
    rtoTargetMinutes: 10,
    automated: true,
    requiresHumanApproval: false,
  },
  LEVEL_5_STORAGE_RECOVERY: {
    level: 'LEVEL_5_STORAGE_RECOVERY',
    rpoTargetMinutes: 15,
    rtoTargetMinutes: 30,
    automated: false,
    requiresHumanApproval: true,
  },
  LEVEL_6_FULL_APPLICATION_RECOVERY: {
    level: 'LEVEL_6_FULL_APPLICATION_RECOVERY',
    rpoTargetMinutes: 30,
    rtoTargetMinutes: 60,
    automated: false,
    requiresHumanApproval: true,
  },
  LEVEL_7_DISASTER_RESTORE: {
    level: 'LEVEL_7_DISASTER_RESTORE',
    rpoTargetMinutes: 60,
    rtoTargetMinutes: 120,
    automated: false,
    requiresHumanApproval: true,
  },
};
