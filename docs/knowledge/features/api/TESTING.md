# Testing Strategy & Synthetic Scenarios

## Test Architecture

Phase 6.9 features 11 test suites under `tests/knowledge/features/api/`:

| Suite | File | Tests | Focus Areas |
|---|---|---|---|
| **Query Validation** | `validationAndErrors.test.ts` | 9 | Parameter bounds, type constraints, missing IDs, scope mismatches |
| **Query Planner** | `queryPlanner.test.ts` | 5 | Unrequested section skipping, deduplication, context expansion, boolean flags |
| **Section Retrieval** | `sectionRetrieval.test.ts` | 8 | Independent section retrieval and all convenience methods |
| **Partial Results** | `partialResultsAndFailures.test.ts` | 3 | Tolerating provider exceptions, distinguishing EMPTY from NOT_COMPUTED |
| **Completeness & Confidence** | `completenessAndConfidence.test.ts` | 3 | Completeness ratio thresholds, multi-factor confidence evaluation |
| **Freshness & Versioning** | `freshnessAndVersioning.test.ts` | 4 | CURRENT enforcement, STALE detection, version consistency |
| **Context Package** | `contextPackage.test.ts` | 3 | Deterministic ranking, token budget bounds, risk prioritization |
| **Caching & Invalidation** | `cachingAndInvalidation.test.ts` | 4 | Cache key dimensions, hit/miss metrics, targeted feature invalidation |
| **Serialization & Security** | `serializationAndSecurity.test.ts` | 5 | Deterministic output, secret sanitization, cross-workspace security |
| **Architectural Boundaries** | `architecturalBoundaries.test.ts` | 2 | Verifying no raw DB/Git/parser drivers in API layer, DI container resolution |
| **Section 30 Scenario** | `syntheticScenario.test.ts` | 2 | Full verification of Section 30 Authentication feature specification |

Total: **48 tests**, 100% passing.

---

## Section 30 Synthetic Authentication Scenario

The synthetic scenario explicitly models:
- **Feature**: `Authentication`
- **Mappings**: `POST /login`, `AuthController.login`, `AuthService.login`, `UserRepository.findByEmail`, `TokenService.generate`, `authentication tests`
- **Dependencies**: `Authentication → User Management`, `Checkout → Authentication`
- **Behavior**: Verified 7-step login execution flow and entry point
- **Health**: Verification quality HIGH, healthScore 88, risks: "missing OAuth failure verification"
- **History**: 4 milestones ("feature created", "login endpoint added", "token refresh flow added", "health improved")

Validates that:
1. `getFeatureKnowledge('feat_auth')` returns a coherent, unified aggregate profile with `status: 'AVAILABLE'` across all sections.
2. Selective queries like `getFeatureKnowledge({ featureId: 'feat_auth', sections: ['IDENTITY', 'MAPPINGS'] })` spy on provider repositories and prove that behavior, health, impact, and history providers are never called.
