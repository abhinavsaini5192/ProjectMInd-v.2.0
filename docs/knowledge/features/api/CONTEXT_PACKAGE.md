# Context Package for LLM Orchestration

## Overview

Future phases (e.g. Context Orchestrator in Phase 6.10) require token-bounded, compact, deterministic context representations of features rather than full raw graph nodes.

`FeatureKnowledgeContextPackage` provides this representation without being tied to any specific model vendor (Claude, Cursor, Codex, Gemini).

---

## Model Structure

```typescript
export interface FeatureKnowledgeContextPackage {
  featureId: string;
  name: string;
  description: string;
  identity: Record<string, any>;
  entryPoints: string[];
  primaryResources: string[];
  directDependencies: string[];
  importantDependents: string[];
  primaryFlows: string[];
  highSeverityRisks: string[];
  healthSummary: Record<string, any>;
  recentHistory: string[];
  impactSummary: Record<string, any>;
  estimatedTokens: number;
  completeness: string;
  confidence: number;
}
```

---

## Prioritization Hierarchy

When token budgets or compact mode are applied, items are prioritized strictly according to Section 19:

1. **Feature Identity**: Base name, status, and description (mandatory).
2. **Entry Points**: HTTP endpoints, RPCs, CLI entry points.
3. **Primary Implementation Resources**: Core classes, controllers, and services.
4. **Direct Dependencies**: Features this feature directly relies on.
5. **Primary Behavior Flows**: Verified success paths through the system.
6. **High-Severity Risks**: Security vulnerabilities and critical flaws (`HIGH` / `CRITICAL` only).
7. **Important Health Information**: Score and status summary.
8. **Recent Meaningful History**: Key milestones and breaking change events.
9. **Relevant Impact**: Immediate downstream blast radius.

Under tight token limits (< 500 tokens), low-priority collections are truncated to top items (e.g. max 3 entry points, max 5 primary resources, max 2 risks) rather than cutting strings into invalid JSON fragments.
