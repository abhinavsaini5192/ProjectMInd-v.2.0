# Project Scope & Security Isolation — Phase 9.2

## 1. Overview & Hierarchy

ProjectMind strictly enforces resource access boundaries through the Phase 8 security architecture extended in Phase 9.2.

The resource scope hierarchy is:

```text
Global Platform Scope
    ↓
Workspace Scope (`ws:<workspaceId>`)
    ↓
Project Scope (`proj:<projectId>`)
    ↓
Repository Scope (`repo:<repositoryId>`)
    ↓
Resource Scope (`feature:<featureId>`, `task:<taskId>`, `sess:<sessionId>`)
```

Formally, a formatted scope string looks like:
`ws:ws_123/proj:proj_456/repo:repo_789`

---

## 2. Containment Logic

The canonical containment algorithm implemented in [ResourceScope.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/models/ResourceScope.ts) via `isScopeContainedWithin(requestScope, authorizedScope)` validates:

1. **Global Scope:** If `authorizedScope.global === true`, all operations are permitted.
2. **Workspace Containment:** If `authorizedScope.workspaceId` is set, `requestScope.workspaceId` must match exactly. Mismatches fail immediately.
3. **Project Containment:** If `authorizedScope.projectId` is set, `requestScope.projectId` must match. A caller authorized for `Project A` cannot access `Project B` even within the same workspace.
4. **Repository Containment:** If `authorizedScope.repositoryId` is set, `requestScope.repositoryId` must match.
5. **Feature / Task / Session Containment:** Granular resource identifiers cannot contradict the authorized scope.

---

## 3. ScopeValidator & Security Violation Detection

The [ScopeValidator](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/core/ScopeValidator.ts) inspects every incoming service or API operation against the caller's [SecurityContext](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/models/SecurityContext.ts).

When a scope violation is detected:
1. It classifies the violation:
   - `CROSS_WORKSPACE_ACCESS`: Attempted access to another tenant's workspace.
   - `CROSS_PROJECT_ACCESS`: Attempted access to another project outside authorized scope.
   - `CROSS_REPOSITORY_ACCESS`: Attempted access to an unauthorized repository.
2. It broadcasts `security.violation.detected` on the EventBus for immediate SIEM / SOC alert ingestion.
3. It throws [ScopeViolationError](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/errors/SecurityError.ts).

---

## 4. Canonical ProjectContext

The [ProjectContext](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/workspace/models/ProjectContext.ts) is the lightweight execution handle passed to all platform subsystems:

```typescript
export interface ProjectContext {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly repositoryId: string;
  readonly repositoryPath?: string;
  readonly securityContext?: SecurityContext;
  readonly configurationVersion: number;
  readonly settings: ProjectSettings;
  readonly knowledgeVersion: number;
  readonly correlationId: string;
  readonly resolvedAt: string;
}
```

### Deterministic Resolution Order

When a CLI command, API request, or agent session begins, `resolveProjectContext()` executes a 3-step deterministic resolution chain:

```text
Step 1: Explicit Project Identifier
        If provided by caller, look up project directly.
        ↓ (if not found or not provided)
Step 2: Repository Association Lookup
        Query project repository bindings by repositoryId.
        ↓ (if unassociated)
Step 3: Workspace Single-Project Fallback
        If workspace contains exactly one active project, bind to it.
        ↓ (if none resolved)
Step 4: Unmanaged Local Fallback
        Provide safe default context for ad-hoc local repositories.
```

---

## 5. Subsystem Scoping Guarantees

| Subsystem | Scoping Invariant |
| :--- | :--- |
| **Context Orchestrator** | Token budgets and retrieval queries are partitioned by `ProjectContext`. A context generation request for Project A will never pull code snippets or symbol summaries from Project B. |
| **Feature Intelligence** | Discovered features are bound to `projectId` and `repositoryId`. There are no global or un-isolated features. |
| **Knowledge Update Loop** | Incremental repository updates modify only knowledge records belonging to the matching project and workspace scope. |
| **Agent Runtime** | Agent sessions inherit the security context and project scope of the caller. Tools and file operations cannot escape the project's repository boundaries. |
