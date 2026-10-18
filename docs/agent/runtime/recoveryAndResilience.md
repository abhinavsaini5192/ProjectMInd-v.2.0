# Runtime Recovery & Resilience

## 1. Checkpointing

The runtime regularly creates serializable `AgentRuntimeCheckpoint` snapshots:
- Active session IDs and task IDs.
- Current runtime state and knowledge/context versions.
- Safe pruning of checkpoints beyond retention limit (`maxCheckpoints`).

## 2. Recovery Procedure

Upon system restart, failover, or error recovery:
1. `AgentRecoveryManager` isolates runtime (`RECOVERING`).
2. `RuntimeRecoveryPlanner` constructs a deterministic 5-step recovery plan.
3. `SessionRecoveryManager` reconciles unexpired active sessions.
4. `ContextRecoveryManager` marks impacted context sessions as stale.
5. Runtime transitions back to `READY` and publishes `RUNTIME_RECOVERED`.
