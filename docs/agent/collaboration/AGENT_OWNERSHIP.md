# Agent Ownership & Resource Reservations

In multi-agent software engineering, overlapping work on code, configuration, and schemas leads to destructive collisions unless ownership and intent are tracked explicitly.

---

## 1. Task Ownership

Task assignment in ProjectMind is explicit and auditable:
- **`ownerAgentId`**: The primary responsible agent.
- **`collaboratorAgentIds`**: Supporting agents assigned to specific subcomponents.
- **`reviewerAgentId`**: Agent designated to evaluate changes.
- **`verifierAgentId`**: Agent or automated pipeline that verifies correctness.
- **`status`**: `UNASSIGNED`, `ASSIGNED`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `FAILED`.

### Assignment Validation Rules
1. Agent must be registered in `AgentRegistry` and in `ACTIVE` state.
2. Agent must be a joined participant in the target `CollaborationSession`.
3. Agent must possess required capabilities for the task.
4. No conflicting assignment can exist for the same task without explicit reassignment.

---

## 2. Resource Reservations vs Concurrency Locks

| Dimension | Concurrency Lock (Phase 8) | Resource Reservation (Phase 9.5) |
| :--- | :--- | :--- |
| **Layer** | Technical concurrency & database engine | Collaboration domain & agent coordination |
| **Purpose** | Atomicity, consistency, dead-lock prevention | Intent signaling, conflict warning, ownership |
| **Duration** | Milliseconds to seconds (critical section) | Minutes to hours (task working session) |
| **Scope** | Mutex / row / key / file descriptor | `FILE`, `SYMBOL`, `MODULE`, `FEATURE`, `API`, `CONFIGURATION` |
| **Behavior on Conflict** | Blocks execution or throws concurrency error | Emits warning / detects collaboration conflict |

---

## 3. Reservation Lifecycle

Reservations maintain an explicit lifecycle:
- `RESERVED`: Held by owner agent with active TTL lease.
- `RENEWED`: Lease extended while agent remains active and heartbeat received.
- `RELEASED`: Voluntarily surrendered by owner upon task completion or handoff.
- `STALE`: Lease expired due to timeout or agent disconnect; eligible for policy reclaim.
- `CONFLICTED`: Concurrent claim attempted by another agent.

### Fine-Grained Granularity
ProjectMind prefers fine-grained reservations over repository-wide locks:
- `FILE`: `src/auth/jwt.ts`
- `SYMBOL`: `AuthService.generateToken`
- `API`: `POST /v1/auth/login`
- `FEATURE`: `feat_user_authentication`
- `CONFIGURATION`: `config/database.yml`
