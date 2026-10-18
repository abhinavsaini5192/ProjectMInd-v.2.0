# Day-2 Operations & Process Lifecycle

## 1. Process Lifecycle

The ProjectMind platform process progresses through formal lifecycle states:
`CREATED` $\to$ `STARTING` $\to$ `READY` $\to$ `STOPPING` $\to$ `STOPPED`.

## 2. Graceful Shutdown

When receiving termination signals (`SIGTERM` or `SIGINT`), the platform coordinates an orderly 10-step shutdown:
1. Stop accepting new inbound agent requests.
2. Stop new agent tasks.
3. Pause in-flight agent runtime operations.
4. Checkpoint active agent sessions & tasks via `ProductionAgentRuntime.createCheckpoint('shutdown_checkpoint')`.
5. Flush telemetry and metrics to collectors.
6. Close external agent adapters.
7. Unsubscribe EventBus listeners.
8. Flush and close cache subsystems.
9. Safely close database connections and file descriptors.
10. Exit cleanly with return code `0`.

## 3. Shutdown Timeout Enforcement

The shutdown sequence is bounded by `PROJECTMIND_SHUTDOWN_TIMEOUT_MS` (default: 15 seconds). If the steps exceed this duration, the platform logs a warning and forces immediate termination to avoid hanging container orchestrators.
