export interface AgentRegistration {
  readonly agentId: string;
  readonly name: string;
  readonly role?: string | undefined;
  readonly status: string;
  readonly capabilities?: readonly string[] | undefined;
  readonly registeredAt?: number | string | undefined;
  readonly lastHeartbeat?: number | string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
