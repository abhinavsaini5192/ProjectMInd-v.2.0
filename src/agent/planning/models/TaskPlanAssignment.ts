export interface TaskPlanAssignment {
  readonly agentId: string;
  readonly assignedAt: number;
  readonly role?: string | undefined;
  readonly requiredCapabilities: readonly string[];
  readonly assignedBy?: string | undefined;
  readonly reason?: string | undefined;
}
