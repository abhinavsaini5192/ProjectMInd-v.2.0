import type { TaskType } from './TaskType.js';
import type { TaskNodeStatus } from './TaskNodeStatus.js';
import type { TaskPlanDependency } from './TaskPlanDependency.js';
import type { TaskConstraint } from './TaskConstraint.js';
import type { TaskPlanAssignment } from './TaskPlanAssignment.js';
import type { TaskVerificationRequirement } from './TaskVerificationRequirement.js';
import type { TaskContextRequirement } from './TaskContextRequirement.js';
import type { ApprovalRecord } from './ApprovalStatus.js';

export const TaskRiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type TaskRiskLevel = (typeof TaskRiskLevel)[keyof typeof TaskRiskLevel];

export const TaskPriority = {
  LOW: 1,
  MEDIUM: 5,
  HIGH: 8,
  CRITICAL: 10,
} as const;

export type TaskPriority = number;

export interface TaskPlanNode {
  readonly id: string; // unique node ID (e.g. node_1, step_auth_api)
  readonly planId: string;
  readonly taskId: string; // bound or generated task ID for TaskRuntime
  readonly title: string;
  readonly objective: string;
  readonly description?: string | undefined;
  readonly taskType: TaskType;
  readonly status: TaskNodeStatus;
  readonly priority: number; // 1 (lowest) to 10 (highest)
  readonly dependencies: readonly TaskPlanDependency[];
  readonly requiredCapabilities: readonly string[];
  readonly preferredAgentRole?: string | undefined;
  readonly affectedFeatures: readonly string[];
  readonly affectedResources: readonly string[];
  readonly requiredContext?: TaskContextRequirement | undefined;
  readonly verificationPolicy?: TaskVerificationRequirement | undefined;
  readonly risk: TaskRiskLevel;
  readonly constraints?: readonly TaskConstraint[] | undefined;
  readonly assignment?: TaskPlanAssignment | undefined;
  readonly executionReference?: string | undefined;
  readonly checkpointReference?: string | undefined;
  readonly approval?: ApprovalRecord | undefined;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly failureReason?: string | undefined;
  readonly retryCount?: number | undefined;
  readonly maxRetries?: number | undefined;
  readonly estimatedDurationMinutes?: number | undefined;
  readonly error?: { readonly category: string; readonly message: string } | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
