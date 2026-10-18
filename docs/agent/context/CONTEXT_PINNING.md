# Context Pinning & Priority Retention

## 1. Overview

During complex or multi-stage coding tasks, an agent may focus on specific files or features that must not be evicted during token budgeting or smart refreshes.

ProjectMind supports **Context Pinning** for:
- **`FEATURE`**: High-priority feature knowledge (e.g. `feat-auth`).
- **`RESOURCE`**: Specific code files or interfaces (e.g. `src/auth/AuthService.ts`).
- **`SECTION`**: Dedicated knowledge sections (e.g. `TESTS` or `DEPENDENCIES`).

## 2. Pin Schema

```typescript
export interface ContextPin {
  readonly pinId: string;
  readonly contextSessionId: string;
  readonly type: 'FEATURE' | 'RESOURCE' | 'SECTION';
  readonly targetId: string;
  readonly pinnedAt: Date;
  readonly pinnedBy: string;
  readonly reason?: string | undefined;
}
```

## 3. Budget Priority & Invalidation Protections

- **Priority Allocation**: Pinned items are assigned maximum priority weighting during Context Orchestrator budgeting. They are protected from pruning unless the total token budget is lower than the pinned item size itself.
- **Scope & Security Validation**: Agents cannot pin arbitrary strings or path-traversal expressions (e.g. `../../etc/passwd` or null bytes). Target resources must resolve cleanly within authorized workspace bounds.
- **Unpinning**: Pins can be dynamically removed by the agent at any point via `projectmind_unpin_context`.
