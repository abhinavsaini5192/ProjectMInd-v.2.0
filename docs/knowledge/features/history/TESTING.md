# Testing Strategy & Synthetic Cases

## 1. Test Suite Structure

The Phase 6.8 test suite is located in `tests/knowledge/features/history/`:

| Test File | Focus Area |
| :--- | :--- |
| `modelsAndTypes.test.ts` | Model construction, type predicates, and custom error classes |
| `normalizationAndOrdering.test.ts` | Deterministic ordering, conflict detection, episode building |
| `sourcesAndCorrelation.test.ts` | All 11 source adapters, coordinator event fetching, formatting commit handling |
| `timelineAndVersions.test.ts` | Timeline aggregation, meaningful vs technical counts, semantic versions |
| `milestonesAndRegressions.test.ts` | Milestone detection, regression detection across health/risk/flows |
| `trendsAndMaturity.test.ts` | Multi-observation trends, growth metrics, multi-factor maturity |
| `explainabilityAndComparisons.test.ts` | Explainer summaries and before/after snapshot diffs |
| `incrementalAndRebuild.test.ts` | Incremental single-feature updates, rebuilds, repository persistence |
| `boundariesAndSecurity.test.ts` | Docstring injection immunity, invalid ID handling, DI registration |
| `architecturalBoundaries.test.ts` | Static scan ensuring no forbidden imports (fs, child_process, sqlite, network) |
| `syntheticCases.test.ts` | Verification of all 15 required synthetic scenarios |

## 2. 15 Required Synthetic Cases

1. **Feature Creation**: Authentication first appears $\rightarrow$ initial snapshot and milestone.
2. **Feature Expansion**: OAuth flow and endpoint added $\rightarrow$ expansion milestone, positive growth metrics.
3. **Dependency Growth**: Checkout begins depending on Authentication $\rightarrow$ dependency milestone, criticality escalation.
4. **Health Improvement**: Tests added $\rightarrow$ health milestone, positive verification trend.
5. **Risk Increase**: External integration added without failure flow $\rightarrow$ risk escalation regression and milestone.
6. **Risk Reduction**: Failure handling added $\rightarrow$ risk reduction milestone and declining risk trend.
7. **Behavior Regression**: Previously known flow disappears $\rightarrow$ regression detected with preserved evidence.
8. **Mapping Churn**: Repeated add/remove of resources $\rightarrow$ unstable mapping indicators.
9. **Stable Feature**: Multiple snapshots with consistent mappings and high health $\rightarrow$ stabilization milestone and MATURE rating.
10. **Snapshot Comparison**: Before/after OAuth addition $\rightarrow$ added flows, entry points, resources, and dependencies.
11. **Incomplete History**: Zero prior snapshots available $\rightarrow$ LOW confidence, no invented milestones.
12. **Conflicting Events**: Deprecated vs Active at same version $\rightarrow$ conflict preserved in repository.
13. **Formatting Commit**: Style-only changes $\rightarrow$ technical event recorded, semantic evolution unaffected.
14. **Incremental Update**: Auth updated $\rightarrow$ Auth timeline updates, Payment timeline untouched.
15. **Documentation Injection**: Malicious instruction in docstring $\rightarrow$ safely ignored without corrupting milestones.
