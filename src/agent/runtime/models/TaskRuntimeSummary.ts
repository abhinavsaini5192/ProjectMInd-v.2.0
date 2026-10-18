import type { AgentTaskStatus } from '../../context/models/AgentTask.js';
import type { TaskExecutionStatus } from './TaskExecutionState.js';
import type { VerificationStatus } from './TaskVerificationState.js';

export interface TaskTimelineEntry {
  readonly event: string;
  readonly timestamp: Date;
  readonly actor?: string | undefined;
  readonly details?: Record<string, unknown> | undefined;
}

export interface TaskRuntimeSummary {
  readonly taskId: string;
  readonly title: string;
  readonly description: string;
  readonly state: AgentTaskStatus;
  readonly relevantFeatures: readonly string[];
  readonly changedResources: readonly string[];
  readonly executionState: TaskExecutionStatus;
  readonly verificationState: VerificationStatus;
  readonly blockers: readonly string[];
  readonly contextFreshness: string;
  readonly latestContextVersion: number;
  readonly latestKnowledgeVersion?: number | undefined;
  readonly recentTimeline: readonly TaskTimelineEntry[];
}
