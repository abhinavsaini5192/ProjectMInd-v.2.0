# Resilience, Checkpointing & Recovery

## 1. State Classification

ProjectMind categorizes state into:
- **Persistent State**: Canonical knowledge graphs, task records, session checkpoints, historical verification reports. (Stored in SQLite / persistent volume).
- **Ephemeral State**: In-memory cache entries, transient lock leases, in-flight tool request buffers.

## 2. Recovery on Restart

Upon platform restart following a crash or redeployment:
1. Validates configuration and environment variables.
2. Initializes storage provider and mounts persistent database.
3. Restores active runtime checkpoint via `ProductionAgentRuntime.recover(checkpointId)`.
4. Reconciles sessions and marks context sessions as stale (`STALE_CONTEXT`).
5. Evaluates readiness probes and transitions to `READY`.
6. Normal operations resume without data loss or graph corruption.
