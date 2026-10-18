# Knowledge Invalidation & Context Refresh

## Invalidation Granularity

Rather than invalidating repository-wide caches, ProjectMind implements granular, target-specific invalidation:

```typescript
export type KnowledgeInvalidationTargetType =
  | 'FEATURE_PROFILE'
  | 'FEATURE_CONTEXT'
  | 'FEATURE_MAPPING'
  | 'FEATURE_DEPENDENCY'
  | 'FEATURE_BEHAVIOR'
  | 'FEATURE_HEALTH'
  | 'FEATURE_RISK'
  | 'FEATURE_IMPACT'
  | 'FEATURE_HISTORY'
  | 'CONTEXT_PACKAGE'
  | 'CONTEXT_PLAN'
  | 'AGENT_CONTEXT_SESSION'
  | 'RESOURCE'
  | 'FEATURE';
```

## Refresh Decision Policies

When knowledge updates apply, `KnowledgeRefreshManager` determines the refresh policy based on session and task scope:

| Policy | Condition | Action Taken |
| :--- | :--- | :--- |
| `REFRESH_CURRENT_SESSION` | Update has active `agentSessionId` | Calls `contextSessionManager.markContextStale(sessionId, 'FEATURE_CHANGED')` immediately. |
| `REFRESH_ON_NEXT_REQUEST` | Update has `taskId` but no active session | Records pending refresh flag; re-evaluates upon agent's next request turn. |
| `INVALIDATE_ONLY` | Neither active session nor task present | Invalidates feature caches; avoids eager context generation. |
| `NO_REFRESH_REQUIRED` | No features or resources affected | No-op. |
| `FORCE_REFRESH` | Explicit high-priority override | Immediately triggers eager re-assembly of context window. |

## Lazy Re-Evaluation

ProjectMind adheres to lazy re-evaluation:
- When a feature is invalidated, downstream context packages are marked `STALE`.
- Context packages are **not** eagerly re-synthesized until an agent turn explicitly requests context for that feature.
- This prevents CPU and memory spikes during high-throughput coding agent edits.
