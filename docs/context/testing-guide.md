# Testing Guide for Context Orchestrator

## Test Architecture

The Context Orchestration test suite (`tests/context/`) provides 100% test coverage across 14 dedicated test suites and 50 automated tests.

## Running Tests

### Run Context Orchestrator Tests
```bash
npx vitest run tests/context/
```

### Run Legacy Context Tests (Phase 4 MVP Verification)
```bash
npx vitest run tests/context.test.ts
```

### Run Knowledge Features Integration Regression Tests
```bash
npx vitest run tests/knowledge/features/
```

## Test Suites Summary

| Test File | Focus Area |
| :--- | :--- |
| `requestValidation.test.ts` | Request validation, boundary parameter checks, missing IDs |
| `planning.test.ts` | Plan creation, budget quota allocations, priority weights |
| `retrieval.test.ts` | Task, resource, and feature retrieval via mock knowledge API |
| `selection.test.ts` | Multi-factor relevance scoring, deduplication, primary role ranking |
| `budgeting.test.ts` | Token estimation, compact mode, deterministic truncation |
| `packaging.test.ts` | Canonical ContextPackage assembly, completeness, and freshness |
| `adapters.test.ts` | All 7 adapters (Generic, Claude XML, OpenAI, Gemini, Cursor, Codex, JSON) |
| `promptComposition.test.ts`| Output delimiter wrapping and compiledPromptText generation |
| `freshness.test.ts` | `CURRENT` vs `ALLOW_STALE` caching policy execution |
| `caching.test.ts` | Cache key generation, TTL expiration, repository invalidation |
| `security.test.ts` | Secret redaction (passwords, tokens, API keys), circular dep detection |
| `brainContract.test.ts` | `ContextProvider` methods (`getContextForTask`, etc.) |
| `endToEnd.test.ts` | Realistic end-to-end task text and changed-resource scenarios |
| `architecturalBoundaries.test.ts` | Scans `src/context/` to verify zero SQLite, Git, or AST parser leaks |
