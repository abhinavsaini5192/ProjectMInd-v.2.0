# Project Lifecycle & State Transitions — Phase 9.2

## 1. Overview & Principle

ProjectMind manages projects through an explicit state machine defined in [ProjectStatus.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/workspace/models/ProjectStatus.ts). 

State transitions are **never inferred** from arbitrary background activity or file system changes. Every transition is:
- **Explicit**: Executed via canonical methods in [ProjectService](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/workspace/services/ProjectService.ts).
- **Validated**: Checked against the valid transition matrix.
- **Audited**: Recorded in the platform audit log.
- **Published**: Broadcast across the platform EventBus with version, correlation ID, and actor provenance.

---

## 2. State Machine Diagram

```text
       ┌───────────┐
       │  CREATED  │
       └─────┬─────┘
             │
             ▼
      ┌─────────────┐
      │ INITIALIZING│
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐  ◄───────┐
 ┌───►│   ACTIVE    ├───────┐  │
 │    └──────┬──────┘       │  │
 │           │              │  │
 │           ▼              ▼  │
 │    ┌─────────────┐   ┌─────────────┐
 └───-┤   PAUSED    │   │  ARCHIVED   ├────┐
      └─────────────┘   └─────────────┘    │
                                           ▼
                                    ┌─────────────┐
                                    │  COMPLETED  │
                                    └─────────────┘
```

---

## 3. Transition Matrix

The valid state transitions enforced by `isValidProjectTransition()`:

| From State | Allowed Target States | Description |
| :--- | :--- | :--- |
| `CREATED` | `INITIALIZING`, `ACTIVE`, `ARCHIVED` | Initial registration. Can start bootstrap or activate directly. |
| `INITIALIZING` | `ACTIVE`, `PAUSED`, `ARCHIVED` | Indexing and knowledge initialization phase. |
| `ACTIVE` | `PAUSED`, `ARCHIVED`, `COMPLETED` | Normal operational state. |
| `PAUSED` | `ACTIVE`, `ARCHIVED` | Temporarily stopped indexing/updates. Can be resumed. |
| `ARCHIVED` | `ACTIVE`, `COMPLETED` | Soft-archived state. Can be restored or marked terminal completed. |
| `COMPLETED` | *(Terminal)* | Project retired or superseded. Read-only forever. |

---

## 4. Lifecycle Policies & Operational Guardrails

### 1. Archived Project Immutability
When a project enters `ARCHIVED` or `COMPLETED` status:
- All update calls (`updateProject`, `attachRepository`, `detachRepository`) are rejected with `INVALID_PROJECT_STATE`.
- Analysis scans, knowledge updates, and agent execution sessions targeting the project are blocked.
- Retrieval operations remain accessible for historical queries, audits, and compliance inspection.

### 2. Soft-Archival vs. Destructive Deletion
ProjectMind strongly enforces **retention over destruction**:
- `deleteProject()` is an alias for safe soft-archival.
- Deleting or archiving a project **NEVER** deletes underlying Git source repositories, commit history, or audit logs.
- Projects can be safely restored to `ACTIVE` using `restoreProject()`.

### 3. Parent Workspace Lifecycle Coupling
A project cannot operate independently of its parent workspace:
- If a workspace is `SUSPENDED`, all child project operations fail with `WORKSPACE_NOT_ACTIVE`.
- If a workspace is `ARCHIVED`, all child projects become read-only.
- New projects cannot be created inside inactive workspaces.

---

## 5. Event Publishing Matrix

Every transition emits a typed event on the EventBus:

| Transition | Event Name | Payload Scope |
| :--- | :--- | :--- |
| Project Creation | `project.created` | `{ workspaceId, projectId }` |
| Project Update | `project.updated` | `{ workspaceId, projectId }` |
| Project Initialization | `project.initialized` | `{ workspaceId, projectId }` |
| Project Archival | `project.archived` | `{ workspaceId, projectId }` |
| Project Restoration | `project.restored` | `{ workspaceId, projectId }` |
| Repository Attached | `project.repository.attached` | `{ workspaceId, projectId, repositoryId }` |
| Repository Detached | `project.repository.detached` | `{ workspaceId, projectId, repositoryId }` |
