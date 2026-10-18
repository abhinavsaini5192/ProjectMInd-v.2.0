# Agent Runtime State Machine

## 1. Runtime State Enumeration

The Production Agent Runtime enforces a formal, deterministic state machine with the following states:

- `CREATED`: Runtime instantiated, dependencies attached, not yet initialized.
- `INITIALIZING`: In process of initializing subsystems, loading initial configuration, validating environment.
- `READY`: Initialized and ready to accept sessions, tasks, and tool calls.
- `RUNNING`: Actively processing agent operations, coordinating active sessions and tasks.
- `PAUSED`: Temporarily paused (e.g. for maintenance or checkpoint creation). Inbound operations are rejected with `RuntimeNotReadyError`.
- `DEGRADED`: Running with degraded non-critical subsystems (e.g., telemetry or optional cache disabled).
- `RECOVERING`: Recovering state from a checkpoint or executing post-crash reconciliation.
- `STOPPING`: Draining in-flight tasks and closing active sessions in an orderly shutdown.
- `STOPPED`: Runtime halted. Operations are rejected.
- `FAILED`: Unrecoverable runtime fault occurred. Requires recovery procedure or restart.

## 2. Transition Matrix

| From State | Allowed Target States |
| :--- | :--- |
| `CREATED` | `INITIALIZING`, `STOPPED`, `FAILED` |
| `INITIALIZING` | `READY`, `FAILED`, `STOPPED` |
| `READY` | `RUNNING`, `PAUSED`, `DEGRADED`, `STOPPING`, `FAILED` |
| `RUNNING` | `READY`, `PAUSED`, `DEGRADED`, `STOPPING`, `FAILED` |
| `PAUSED` | `READY`, `RUNNING`, `STOPPING`, `FAILED` |
| `DEGRADED` | `READY`, `RUNNING`, `RECOVERING`, `STOPPING`, `FAILED` |
| `RECOVERING` | `READY`, `DEGRADED`, `FAILED`, `STOPPED` |
| `STOPPING` | `STOPPED`, `FAILED` |
| `STOPPED` | `INITIALIZING` |
| `FAILED` | `RECOVERING`, `STOPPED` |

## 3. Operational Gating

Operations such as `createSession`, `submitTask`, `executeTool`, and `getContext` verify that the runtime state is operational (`READY`, `RUNNING`, or `DEGRADED`). If the runtime is in any other state, calls are rejected immediately with `RuntimeNotReadyError`.
