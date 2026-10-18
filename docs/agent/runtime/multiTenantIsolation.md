# Multi-Tenant Workspace & Repository Isolation

## 1. Isolation Guarantees

ProjectMind supports multi-tenant deployments where different external agents work on different repositories or workspaces simultaneously.

## 2. Scope Validation Rules

1. Every inbound session, task, context, and tool request must specify `workspaceId` and `repositoryId`.
2. Cross-workspace attempts to access another tenant's session, task, or context session are strictly rejected with `RuntimeScopeError`.
3. Checkpoints and telemetry distinguish tenants to prevent data leakage or noisy-neighbor interference.
