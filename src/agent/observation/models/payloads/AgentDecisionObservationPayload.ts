export interface AgentDecisionObservationPayload {
  readonly decisionId: string;
  readonly description: string;
  readonly rationale?: string | undefined;
  readonly affectedResources?: readonly string[] | undefined;
  readonly alternativesConsidered?: readonly string[] | undefined;
}
