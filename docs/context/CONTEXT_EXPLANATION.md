# Context Explanation & Exclusion Reasoning

## 1. Overview

AI agents and human engineers must understand **why** specific context was selected and why other candidates were excluded.

The [`ContextExplanationEngine`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextExplanationEngine.ts) generates structured explanations that accompany every package.

## 2. Inclusions with Primary Evidence

Every selected context item carries evidence explaining its inclusion:
- Direct task keyword / entity match
- Core participant in feature mapping
- Active modification in working tree (`git status`)
- Association with recent verification failure (`test / build failure`)
- Direct structural or behavioral dependency

## 3. Notable Exclusions

Exclusions are tracked with explicit stages and rationales:
- **`RELEVANCE_THRESHOLD`**: Candidate relevance score fell below minimum threshold (e.g. documentation or distant libraries unrelated to the task).
- **`TOKEN_BUDGET`**: Candidate was relevant but inclusion would exceed configured token limits.
- **`SCOPE_BOUNDARY`**: Candidate belongs to an unauthorized repository or foreign project partition.
- **`CONFIDENCE_FLOOR`**: Grounding evidence confidence was below acceptable reliability.

## 4. CLI & API Access

Explanations are exposed in the CLI via the `--explain` flag:
```bash
projectmind context "Fix authentication timeout" --explain
```
And programmatically via:
```typescript
const result = await orchestrator.orchestrateContext({
  taskText: 'Fix authentication timeout',
  explainSelection: true,
});

console.log(result.explanations);
console.log(result.package.exclusions);
```
