# Feature History Architecture

## 1. Pipeline Overview

The Feature History engine processes knowledge and historical events through a unidirectional pipeline:

```
Existing Knowledge (Phases 6.1 - 6.7)
              ↓
Sources (11 Source Adapters)
              ↓
FeatureHistoryCoordinator
              ↓
FeatureHistoryNormalizer (Ordering & Conflict Detection)
              ↓
FeatureEvolutionBuilder (Grouping into Episodes)
              ↓
FeatureTimelineAggregator (Timeline Construction)
              ↓
FeatureMilestoneDetector (Milestone Derivation)
              ↓
FeatureTrendAnalyzer (Metrics, Trends, Maturity, Regressions)
              ↓
FeatureVersionResolver (Semantic Versioning)
              ↓
FeatureHistoryEngine & API
```

## 2. Core Components

### FeatureHistoryCoordinator
Aggregates events across 11 source adapters:
- `DiscoveryHistorySource`
- `FeatureChangeHistorySource`
- `MappingHistorySource`
- `DependencyHistorySource`
- `BehaviorHistorySource`
- `HealthHistorySource`
- `RiskHistorySource`
- `ImpactHistorySource`
- `ArchitectureHistorySource`
- `StatusHistorySource`
- `RepositoryHistorySource`

### FeatureHistoryNormalizer
Orders events deterministically according to:
1. `knowledgeVersion` (lexicographical / semantic version)
2. `timestamp`
3. `eventType` priority
4. Stable `eventId`
Detects contradictory states (e.g. `FEATURE_DEPRECATED` vs `FEATURE_REACTIVATED` at the same version).

### FeatureEvolutionBuilder
Correlates fine-grained updates into *Evolution Episodes* within bounded time windows (`episodeWindowMs`, default 5m) or shared knowledge versions. Distinguishes semantic architectural changes from technical changes (formatting, chore).

### FeatureMilestoneDetector
Derives milestones solely from empirical evidence:
- First creation and discovery
- Status transitions (e.g. `ACTIVE`)
- Substantial growth (+resources, +entry points, +flows)
- First dependent feature (e.g. `checkout` depends on `auth`)
- Verified health improvements and risk reductions
- Stabilization across multiple snapshots

### FeatureTrendAnalyzer
Analyzes multi-snapshot trajectories:
- Growth metrics (deltas and normalized percentage changes)
- Trend detection (requires $\ge 2$ observations)
- Multi-factor maturity evaluation (stability, verification, mappings, topology)
- Regression detection (score drops, risk spikes, missing flows)

### FeatureHistoryExplainer
Synthesizes structured before/after comparisons and human-readable natural language evolution summaries.
