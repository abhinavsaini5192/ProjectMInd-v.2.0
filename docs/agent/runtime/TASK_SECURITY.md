# Task Security & Scope Isolation (Phase 7.5)

## 1. Multi-Tenant Scope Hierarchy

ProjectMind enforces strict multi-tenant isolation across all tasks and context sessions:

```
Workspace
  └── Repository
        └── Agent Task
              └── Task Lease (Owned by Agent Session)
```

### Scope Validation Rules

1. **Workspace Boundary**: A task created in `workspace-A` cannot be viewed, updated, executed against, or completed by an agent session operating in `workspace-B`. Violations throw `TaskScopeError`.
2. **Repository Boundary**: Within a workspace, tasks are scoped to their repository ID. Cross-repository modification attempts throw `TaskScopeError`.
3. **Session Ownership & Lease Integrity**: While a task has an active, unexpired lease owned by `session-1`, any modifying command (`complete`, `cancel`, `update`, `reportExecution`, `reportVerification`) issued by `session-2` is rejected with `TaskLeaseConflictError`.
4. **Zero Filesystem or Shell Access**: The Task Runtime has zero access to filesystem APIs, subprocess spawning, git binary execution, or AST parsing tools, eliminating command injection and arbitrary file write attack surfaces.
