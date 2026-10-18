export interface LatencyMetric {
  readonly count: number;
  readonly totalMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly avgMs: number;
}

export interface AgentRuntimeMetrics {
  readonly activeSessions: number;
  readonly activeTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly pausedTasks: number;
  readonly contextRequests: number;
  readonly contextRefreshes: number;
  readonly toolExecutions: number;
  readonly toolFailures: number;
  readonly observationsIngested: number;
  readonly verificationsProcessed: number;
  readonly knowledgeUpdatesTriggered: number;
  readonly staleContextDetections: number;
  readonly checkpointsCreated: number;
  readonly recoveriesAttempted: number;
  readonly recoveriesSucceeded: number;
  readonly errorsCount: number;
  readonly latencies: {
    readonly contextRetrieval: LatencyMetric;
    readonly toolExecution: LatencyMetric;
    readonly observationProcessing: LatencyMetric;
    readonly verificationProcessing: LatencyMetric;
    readonly knowledgeUpdate: LatencyMetric;
    readonly checkpointCreation: LatencyMetric;
    readonly recovery: LatencyMetric;
  };
}

export function createInitialMetrics(): AgentRuntimeMetrics {
  const emptyLatency: LatencyMetric = { count: 0, totalMs: 0, minMs: 0, maxMs: 0, avgMs: 0 };
  return {
    activeSessions: 0,
    activeTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    pausedTasks: 0,
    contextRequests: 0,
    contextRefreshes: 0,
    toolExecutions: 0,
    toolFailures: 0,
    observationsIngested: 0,
    verificationsProcessed: 0,
    knowledgeUpdatesTriggered: 0,
    staleContextDetections: 0,
    checkpointsCreated: 0,
    recoveriesAttempted: 0,
    recoveriesSucceeded: 0,
    errorsCount: 0,
    latencies: {
      contextRetrieval: { ...emptyLatency },
      toolExecution: { ...emptyLatency },
      observationProcessing: { ...emptyLatency },
      verificationProcessing: { ...emptyLatency },
      knowledgeUpdate: { ...emptyLatency },
      checkpointCreation: { ...emptyLatency },
      recovery: { ...emptyLatency },
    },
  };
}
