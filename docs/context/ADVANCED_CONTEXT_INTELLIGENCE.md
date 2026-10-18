# Advanced Context Intelligence (Phase 9.3)

## 1. Overview & Core Philosophy

ProjectMind Phase 9.3 upgrades the Context Orchestrator from static knowledge retrieval into a task-aware, project-aware, and evidence-grounded intelligence layer. 

The primary guiding principle is:
> **"What information does an AI coding agent actually need for this task?"**
>
> We optimize for *relevance, correctness, completeness, freshness, explainability, scope, token efficiency, confidence, and task alignment* rather than blindly maximizing context quantity.

## 2. Advanced Context Pipeline

```
User Task / Agent Request
        ↓
1. Task Understanding & Classification (TaskUnderstandingEngine)
        ↓
2. Scope Resolution & Boundary Check (ProjectContext, Workspace, Repo)
        ↓
3. Context Planning & Feature Resolution (ContextPlanner, FeatureKnowledgeAPI)
        ↓
4. Candidate Knowledge Generation (ContextCandidateResolver)
        ↓
5. Multi-dimensional Relevance Evaluation (ContextRelevanceEngine)
        ↓
6. Controlled Progressive Expansion (ContextExpansionEngine)
        ↓
7. Context Compression & Symbol Fragment Selection (ContextCompressionEngine)
        ↓
8. Token Budget Allocation (TokenBudgetManager)
        ↓
9. Canonical Context Packing (ContextPacker)
        ↓
10. Explanation & Quality Assessment (ContextExplanationEngine, ContextQualityEvaluator)
        ↓
11. Scope & Budget Validation (ContextValidator)
        ↓
ContextPackage → Agent Runtime
```

## 3. Component Architecture

| Component | Responsibility | Determinism / AI |
|---|---|---|
| [`TaskUnderstandingEngine`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/task/TaskUnderstandingEngine.ts) | Normalizes input, classifies task type, extracts intent & constraints | Hybrid (optional SLM with deterministic fallback) |
| [`ContextCandidateResolver`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextCandidateResolver.ts) | Generates candidate knowledge items across features, files, dependencies, behavior, risks, verification | Deterministic |
| [`ContextRelevanceEngine`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextRelevanceEngine.ts) | Computes 12-dimensional relevance profile and assigns priority (CRITICAL/HIGH/MEDIUM/LOW/OPTIONAL) | Deterministic |
| [`ContextExpansionEngine`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextExpansionEngine.ts) | Performs controlled 6-level expansion bounded by budget and threshold; logs exclusions | Deterministic |
| [`ContextCompressionEngine`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextCompressionEngine.ts) | Applies FULL, COMPACT, SUMMARY, REFERENCE_ONLY compression and extracts symbol AST fragments | Deterministic |
| [`ContextQualityEvaluator`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextQualityEvaluator.ts) | Evaluates 7-dimensional context quality profile | Deterministic |
| [`ContextValidator`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextValidator.ts) | Pre-delivery validation of workspace/project scope, budget caps, and duplicate resources | Deterministic |
| [`ContextExplanationEngine`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextExplanationEngine.ts) | Generates evidence-based inclusion reasons and exclusion justifications | Deterministic |

## 4. Key Invariants & Non-Negotiables

1. **Deterministic Default**: The system is completely autonomous and operational without any external AI model. AI/SLMs provide assistive natural language interpretation only.
2. **AI Cannot Authorize**: Semantic models cannot alter security scopes, bypass project boundaries, or promote unverified facts to authoritative state.
3. **Strict Project Isolation**: Context requests cannot access data outside authorized workspace and project scopes.
4. **Token Budget Integrity**: Packages never silently overflow configured token limits.
5. **No Blind Full Scans**: Context resolution uses indexed knowledge graphs, feature knowledge profiles, and caches.
