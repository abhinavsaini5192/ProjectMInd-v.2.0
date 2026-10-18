# Metrics & Telemetry

## 1. Metrics Collector

The `AgentRuntimeTelemetry` service tracks runtime health and operation rates:
- `activeSessions`: Current active sessions gauge.
- `activeTasks`: Current active tasks gauge.
- `completedTasks`: Lifetime completed tasks counter.
- `failedTasks`: Lifetime failed tasks counter.
- `toolExecutions` & `toolFailures`: Tool invocation statistics.
- `contextRefreshes`: Total context refreshes triggered.
- `errorsCount`: Count of capacity rejections and validation errors.
- `latencies`: Percentiles and averages for context retrieval, tool execution, and recovery.

## 2. Capacity & Backpressure

When limits configured in `AgentRuntimeLimits` are reached:
- Requests are rejected immediately with `RuntimeCapacityError`.
- Rejection increments `errorsCount` in telemetry, enabling proactive alerting and autoscaling.
