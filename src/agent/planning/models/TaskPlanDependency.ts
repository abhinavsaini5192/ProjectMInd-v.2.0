import type { TaskDependencyType } from './TaskDependencyType.js';

export interface TaskPlanDependency {
  readonly targetNodeId: string;
  readonly type: TaskDependencyType;
  readonly description?: string | undefined;
  readonly requiredArtifactId?: string | undefined;
}
