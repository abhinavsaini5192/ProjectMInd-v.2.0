# Context Selection, Multi-dimensional Relevance & Progressive Expansion

## 1. Candidate Generation

The [`ContextCandidateResolver`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextCandidateResolver.ts) pulls knowledge elements from the repository knowledge graph and Feature Knowledge API across 18 candidate types:

- `FEATURE`: Canonical system feature definitions.
- `FILE`: Source code and test files.
- `SYMBOL`: Methods, classes, functions, interfaces.
- `MODULE`, `PACKAGE`: Code organizational units.
- `ENDPOINT`: HTTP / gRPC / GraphQL API endpoints.
- `DATABASE_ENTITY`: Tables, schemas, models.
- `CONFIGURATION`: Env configs, config files.
- `DEPENDENCY`: Upstream and downstream module/feature links.
- `TEST`: Verification suites and unit tests.
- `ARCHITECTURE_COMPONENT`: Structural architecture layers.
- `HISTORY_EVENT`: Git commits, milestones, regressions.
- `HEALTH_SIGNAL`, `RISK`: Feature risk levels and health scores.
- `IMPACT`: Blast radius and change propagation paths.
- `BEHAVIOR_STEP`: Entry points and execution flow chains.
- `AGENT_SESSION_CONTEXT`, `PROJECT_MEMORY_REFERENCE`.

## 2. 12-Dimensional Relevance Model

The [`ContextRelevanceEngine`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextRelevanceEngine.ts) scores candidates without collapsing dimensions into an unexplainable single score:

1. `taskRelevance`: Lexical, entity, and resource match with task request.
2. `featureRelevance`: Direct participation in resolved feature.
3. `architecturalRelevance`: Strategic role (service, handler, controller, repository).
4. `dependencyRelevance`: Direct vs. indirect technical dependency.
5. `behavioralRelevance`: Position along primary flow / entry points.
6. `changeRelevance`: Status in working tree (modified, unstaged, staged).
7. `historyRelevance`: Relevance to bug fix or regression investigation.
8. `riskRelevance`: Associated security, complexity, or stability risk.
9. `verificationRelevance`: Involvement in failed tests or verification errors.
10. `recency`: Chronological recency of recent modifications.
11. `confidence`: Grounding confidence of the knowledge source.
12. `scopeRelevance`: Compliance with requested project scope.

## 3. Priority Levels

- `CRITICAL`: Direct implementation files, modified working tree resources, or candidates scoring $\ge 0.85$.
- `HIGH`: Direct dependencies, primary tests, high-relevance behavioral entry points ($\ge 0.70$).
- `MEDIUM`: Secondary dependencies, relevant historical milestones ($\ge 0.50$).
- `LOW`: Ancillary documentation, distant dependencies ($\ge 0.30$).
- `OPTIONAL`: Background context ($< 0.30$).

## 4. Controlled Progressive Expansion

The [`ContextExpansionEngine`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextExpansionEngine.ts) traverses 6 conceptual levels:
- **Level 0**: Task
- **Level 1**: Direct Feature
- **Level 2**: Feature Resources & Primary Symbols
- **Level 3**: Dependencies
- **Level 4**: Behavior Chains & Entry Points
- **Level 5**: History, Risk, and Verification Data
- **Level 6**: Source Code Fragments

Expansion stops when:
1. Relevance drops below configured threshold (default: $0.25$).
2. Candidate token consumption exceeds remaining budget.
3. Scope boundary is reached.
4. Sufficient coverage is attained.
