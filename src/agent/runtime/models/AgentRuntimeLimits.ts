export interface AgentRuntimeLimits {
  readonly maxConcurrentSessions: number;
  readonly maxConcurrentTasks: number;
  readonly maxRequestSizeBytes: number;
  readonly maxResponseSizeBytes: number;
  readonly sessionTimeoutMs: number;
  readonly taskTimeoutMs: number;
  readonly toolTimeoutMs: number;
  readonly contextTimeoutMs: number;
  readonly recoveryTimeoutMs: number;
  readonly shutdownTimeoutMs: number;
}

export const DEFAULT_AGENT_RUNTIME_LIMITS: AgentRuntimeLimits = {
  maxConcurrentSessions: 10,
  maxConcurrentTasks: 20,
  maxRequestSizeBytes: 10 * 1024 * 1024,
  maxResponseSizeBytes: 10 * 1024 * 1024,
  sessionTimeoutMs: 3600000, // 1 hour
  taskTimeoutMs: 1800000,    // 30 minutes
  toolTimeoutMs: 30000,      // 30 seconds
  contextTimeoutMs: 30000,   // 30 seconds
  recoveryTimeoutMs: 60000,  // 1 minute
  shutdownTimeoutMs: 15000,  // 15 seconds
};
