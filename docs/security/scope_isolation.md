# Phase 8.2 Hierarchical Scope Isolation & Multi-Tenancy

## 1. Tenancy Model

ProjectMind enforces strict hierarchical resource scoping to guarantee multi-tenant safety.

```
       [ GLOBAL ] (Platform super-administrators only)
           │
           ▼
    [ WORKSPACE ] (Tenant boundary: Organization / Department)
           │
           ▼
   [ REPOSITORY ] (Codebase project boundary within tenant)
           │
     ┌─────┴───────────────┐
     ▼                     ▼
[ FEATURE / TASK ]     [ SESSION ] (Ephemeral execution boundaries)
```

---

## 2. Containment Rules

The `ScopeValidator` mathematically validates that a requested resource scope is fully contained within the principal's authorized scope:

1. **Global Access**:
   - Authorized scope `{ global: true }` contains any request scope.
   - External agents are **never** granted global scope.
2. **Workspace Isolation**:
   - If `authorizedScope.workspaceId !== requestScope.workspaceId`, access is immediately rejected.
   - No horizontal tenant traversal is permitted under any circumstances.
3. **Repository Bounding**:
   - If an agent is authorized for `{ workspaceId: 'W1', repositoryId: 'R1' }`, any request for `{ workspaceId: 'W1', repositoryId: 'R2' }` is rejected with `CROSS_REPOSITORY_ACCESS`.
4. **Task & Session Confinement**:
   - An agent operating within a task scope cannot query or mutate tasks outside its designated session.

---

## 3. Enforcement in Core Services

- **Tool Execution**: `ToolSecurityAuthorizer` compares parameters (`arguments.workspaceId`, `arguments.repositoryId`) with `SecurityContext`.
- **Knowledge Queries**: Context orchestrator queries are filtered by `authorizedScope.workspaceId`.
- **Verification & Observations**: State reports are strictly partitioned by workspace and repository IDs.
