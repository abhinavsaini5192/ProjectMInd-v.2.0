export interface TaskPriorityFactors {
  readonly dependencyImpact: number;
  readonly blockingImpact: number;
  readonly riskImpact: number;
  readonly securityImpact: number;
  readonly userPriority: number;
  readonly readinessBoost: number;
}

export interface TaskPriorityExplanation {
  readonly nodeId: string;
  readonly dependencyImpact: number;
  readonly blockingImpact: number; // how many downstream tasks are unblocked
  readonly riskImpact: number;
  readonly securityImpact: number;
  readonly userPriority: number;
  readonly readiness: string;
  readonly finalScore: number;
  readonly rationale: string;
  readonly factors: TaskPriorityFactors;
}
