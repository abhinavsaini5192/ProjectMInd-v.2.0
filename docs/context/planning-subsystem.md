# Context Planning Subsystem

## Overview

The Context Planning Subsystem (`src/context/planning/`) calculates the context strategy before any knowledge retrieval occurs. It ensures that context generation is deterministic, bounded, and aligned with developer intent.

## Core Responsibilities

1. **Request Validation (`ContextPlanValidator`)**:
   - Ensures workspace and repository scope isolation.
   - Enforces bounds on parameters (`tokenBudget > 0`, `maxDepth >= 0`, `maxFeatures >= 0`, `maxResources >= 0`).
   - Rejects malformed or ambiguous requests.

2. **Scope Resolution (`ContextScopeResolver`)**:
   - Isolates requests to specific `(repositoryId, workspaceId)` tuples, preventing multi-tenant data leakage.

3. **Priority Determination (`ContextPriorityResolver`)**:
   - Assigns priority categories (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `BACKGROUND`).
   - Directly requested features and changed files are always `CRITICAL`.
   - Primary entry points and critical risks are `HIGH`.
   - Indirect dependencies and evolution history default to `LOW` or `BACKGROUND`.

4. **Section Requirement Resolution (`ContextRequirementResolver`)**:
   - Determines the active sections (`IDENTITY`, `RESOURCES`, `ENTRY_POINTS`, `BEHAVIOR`, `DEPENDENCIES`, `TESTS`, `HEALTH`, `IMPACT`, `HISTORY`, `METADATA`, `WARNINGS`, `EXPLANATIONS`).
   - If the request supplies `requestedSections`, those take precedence while preserving `METADATA` and `WARNINGS`.

5. **Dependency Traversal Constraints (`ContextDependencyResolver`)**:
   - Bounds graph exploration to `maxDepth` (default 1, max 3) to prevent combinatorial explosion.

6. **Plan Construction (`ContextPlanBuilder`)**:
   - Calculates dynamic section token quotas based on available budget and active section weights.
