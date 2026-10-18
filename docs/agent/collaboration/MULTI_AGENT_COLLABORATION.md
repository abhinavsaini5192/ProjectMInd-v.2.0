# Multi-Agent Collaboration Architecture

Phase 9.5 introduces the canonical Multi-Agent Collaboration layer for ProjectMind.

## 1. Overview & Principles

ProjectMind coordinates information and ownership among multiple distributed coding agents working concurrently on the same project repository. It does **NOT** operate as an uncontrolled autonomous swarm.

### Core Separation of Concerns

Multi-agent coordination strictly distinguishes:
- **IDENTITY (`AgentIdentity`):** Who is the agent? (Reused from existing Phase 7 Agent Registry).
- **SESSION (`CollaborationSession`):** Which collective team interaction is this? Scoped to Workspace and Project.
- **TASK (`AgentTask`):** What discrete unit of work is assigned?
- **OWNERSHIP (`TaskOwnership`):** Which agent is responsible, assisting, or reviewing?
- **CAPABILITY:** What technical operations is the agent capable of performing?
- **AUTHORIZATION:** What actions is the agent cryptographically and policy-authorized to execute?
- **LOCK:** Concurrency-level mutual exclusion primitive (Phase 8 Concurrency infrastructure).
- **RESERVATION:** Collaboration-level intent and ownership coordination signal (Phase 9.5).
- **CONTEXT:** Task-specific and role-scoped information packet (Phase 9.3 Context Intelligence).
- **OBSERVATION:** Execution output reported by an agent (`AGENT_REPORTED`).
- **VERIFICATION:** Independent test and verification result (`SYSTEM_VERIFIED`).
- **PROVENANCE:** Immutable audit trail of information origin and authority.

---

## 2. Architecture Diagram

```
                    Project
                       │
             Collaboration Layer
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
     Agent A         Agent B         Agent C
    (Backend)       (Frontend)       (Tests)
        │              │              │
        └──────────────┼──────────────┘
                       ↓
              Shared Project State
                       ↓
          ┌────────────┼────────────┐
          ↓            ↓            ↓
       Context       Memory       Knowledge
          ↓            ↓            ↓
             ProjectMind Core
```

---

## 3. Collaboration Session Lifecycle

Collaboration sessions transition through well-defined lifecycle states:
- `CREATED`: Session record created, awaiting initialization.
- `INITIALIZING`: Agents registering and claiming initial roles.
- `ACTIVE`: Active execution, reservations, handoffs, and task coordination.
- `PAUSED`: Temporarily suspended for developer review or conflict settlement.
- `BLOCKED`: Blocked by active blockers, unresolved conflicts, or offline dependencies.
- `COMPLETING`: Tasks finished, final system verification running.
- `COMPLETED`: All deliverables verified by system tests and accepted.
- `FAILED`: Unresolvable conflict or irrecoverable execution failure.
- `CANCELLED`: Manually terminated by operator or supervisor.

---

## 4. Participant Roles

Semantic collaboration roles include:
- `COORDINATOR`: Orchestrates task assignments, merges handoffs, and facilitates recovery.
- `IMPLEMENTER`: Authors code, runs builds, and delivers features or bugfixes.
- `REVIEWER`: Audits diffs, architectural alignment, and code cleanliness.
- `TESTER`: Executes integration, unit, and regression tests.
- `RESEARCHER`: Investigates documentation, library APIs, and dependencies.
- `DOCUMENTATION`: Generates docstrings, API specifications, and READMEs.
- `SECURITY_REVIEWER`: Inspects attack surface, secret hygiene, and permissions.
- `OBSERVER`: Read-only participant listening to event streams.

> **Note:** Collaboration roles are semantic coordination designations. Security permissions are independently enforced through Phase 8 Authorization.

---

## 5. Event-Driven Coordination

All collaboration milestones emit strongly-typed events onto the canonical `EventBus`:
- `collaboration:created`
- `collaboration:participant_joined` / `collaboration:participant_left`
- `collaboration:task_assigned` / `collaboration:task_unassigned`
- `collaboration:resource_reserved` / `collaboration:resource_released`
- `collaboration:conflict_detected` / `collaboration:conflict_resolved`
- `collaboration:handoff_proposed` / `collaboration:handoff_accepted` / `collaboration:handoff_rejected`
- `collaboration:decision_recorded` / `collaboration:decision_promoted`
- `collaboration:checkpoint_created` / `collaboration:recovered`
- `collaboration:completed`
