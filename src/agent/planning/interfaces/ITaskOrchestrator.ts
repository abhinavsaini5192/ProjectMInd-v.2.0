import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { TaskArtifact } from '../models/TaskArtifact.js';

export interface AdvancePlanResult {
  readonly plan: CanonicalTaskPlan;
  readonly readyNodes: readonly TaskPlanNode[];
  readonly completedNodeIds: readonly string[];
  readonly failedNodeIds: readonly string[];
  readonly isPlanCompleted: boolean;
  readonly isPlanBlocked: boolean;
  readonly tasksStarted: readonly string[];
  readonly planCompleted: boolean;
  readonly reason?: string | undefined;
}

export interface TaskExecutionReport {
  readonly planId: string;
  readonly nodeId: string;
  readonly agentId?: string | undefined;
  readonly status?: 'SUCCESS' | 'FAILURE' | undefined;
  readonly success?: boolean | undefined;
  readonly executionDurationMs?: number | undefined;
  readonly outputSummary?: string | undefined;
  readonly changedFiles?: readonly string[] | undefined;
  readonly artifacts?: readonly any[] | undefined;
  readonly error?: string | undefined;
  readonly failureReason?: string | undefined;
}

export interface TaskVerificationReport {
  readonly planId: string;
  readonly nodeId: string;
  readonly passed: boolean;
  readonly verifier?: string | undefined;
  readonly policy?: string | undefined;
  readonly evidence?: any | undefined;
  readonly failureReason?: string | undefined;
}

export interface ITaskOrchestrator {
  startPlan(planId: string): Promise<CanonicalTaskPlan>;
  pausePlan(planId: string, reason?: string): Promise<CanonicalTaskPlan>;
  resumePlan(planId: string): Promise<CanonicalTaskPlan>;
  cancelPlan(planId: string, reason?: string): Promise<CanonicalTaskPlan>;

  advancePlan(planId: string): Promise<AdvancePlanResult>;
  reportTaskExecution(report: TaskExecutionReport): Promise<AdvancePlanResult>;
  reportTaskVerification(report: TaskVerificationReport): Promise<AdvancePlanResult>;
  recordTaskExecution(
    planId: string,
    nodeId: string,
    execution: { success: boolean; executionDurationMs?: number; artifacts?: any[]; error?: string }
  ): Promise<AdvancePlanResult>;
  recordVerificationResult(
    planId: string,
    nodeId: string,
    verification: { policy: string; passed: boolean; evidence?: string; failureReason?: string }
  ): Promise<AdvancePlanResult>;
}
