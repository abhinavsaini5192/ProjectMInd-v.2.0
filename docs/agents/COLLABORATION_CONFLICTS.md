# Collaboration Conflicts & Resolution

ProjectMind proactively discovers conflicts between concurrent agents before they manifest as broken builds or overwritten code.

---

## 1. Conflict Types

ProjectMind categorizes multi-agent conflicts into 12 distinct types:
1. `RESOURCE_CONFLICT`: Concurrent claims or mutations on the same file, symbol, or module.
2. `TASK_CONFLICT`: Overlapping task scopes or competing assignment requests.
3. `FEATURE_CONFLICT`: Divergent implementations affecting the same functional feature.
4. `API_CONFLICT`: Incompatible changes to public endpoints, schemas, or RPC contracts.
5. `DATA_CONFLICT`: Clashing database migrations, seeds, or entity definitions.
6. `CONFIGURATION_CONFLICT`: Contradictory updates to environment settings or build configs.
7. `DEPENDENCY_CONFLICT`: Conflicting library versions or circular module dependencies.
8. `OWNERSHIP_CONFLICT`: Contested ownership over a component or task.
9. `CONTEXT_CONFLICT`: Contradictory context representations or prompt inputs.
10. `MEMORY_CONFLICT`: Contradictory decisions or architectural principles in project memory.
11. `VERIFICATION_CONFLICT`: Disagreement between agent reports and automated test suite results.
12. `UNKNOWN`: Unclassified anomaly requiring operator inspection.

---

## 2. Conflict Severity Levels

- `LOW`: Informational warning; work may proceed with caution (e.g., adjacent file modification).
- `MEDIUM`: Coordination required; may lead to merge difficulties (e.g., shared interface import).
- `HIGH`: Conflicting mutations on identical resources; operation halted until resolved.
- `CRITICAL`: Architectural collision or security policy violation; session flagged `BLOCKED`.

---

## 3. Conflict Resolution Workflow

```
Conflict Detected (ConflictDetector)
       │
       ▼
CollaborationConflict Recorded (Status: OPEN)
       │
       ▼
Notification Dispatched (collaboration:conflict_detected)
       │
       ├──► Coordinator Agent Mediation
       │         │
       │         ▼
       │    Resolution Recorded (Status: RESOLVED)
       │
       └──► Operator / Developer Escalation (Status: ESCALATED)
```

1. **Detection**: `ConflictDetector` evaluates active reservations, task assignments, and resource references.
2. **Recording**: Structured `CollaborationConflict` record created with affected resources, participants, and detection timestamp.
3. **Mediation**: The `COORDINATOR` agent or human supervisor selects a resolution strategy:
   - Split task into discrete subtasks.
   - Sequence execution order.
   - Release contested reservation.
   - Choose authoritative API schema.
4. **Resolution**: `resolveConflict` records resolution notes and timestamps, updating status to `RESOLVED`.
