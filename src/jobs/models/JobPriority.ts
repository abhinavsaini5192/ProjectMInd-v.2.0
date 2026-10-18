export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export const JOB_PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export function compareJobPriorities(a: JobPriority, b: JobPriority): number {
  return JOB_PRIORITY_WEIGHTS[a] - JOB_PRIORITY_WEIGHTS[b];
}
