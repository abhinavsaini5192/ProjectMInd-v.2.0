# Feature History & Evolution Engine (Phase 6.8)

## 1. Overview

Phase 6.8 implements the **Feature History & Evolution Engine** for **ProjectMind**.
The primary purpose is answering:

> *"How has this feature changed over time, and how has its architecture, behavior, dependencies, health, and implementation evolved?"*

Feature history in ProjectMind is fundamentally distinct from raw Git commit history. It is a **semantic evolution timeline** built from repository knowledge (mapping, behaviors, dependencies, health, risk, and architectural evidence).

## 2. Core Principles

1. **Semantic Evolution Over Git History**: Commits such as formatting or lint adjustments are recorded as technical changes and do not inflate or distort semantic architecture evolution.
2. **Multi-Source Correlated Timeline**: Correlates events from discovery, mapping, dependencies, behaviors, health assessments, and risk evaluations into cohesive *evolution episodes*.
3. **Compact Bounded Snapshots**: Preserves historical states using summaries and stable IDs without serializing entire redundant repository graphs.
4. **Evidence-Based Milestones & Trends**: Milestones (e.g. `FEATURE_EXPANDED`, `FEATURE_STABILIZED`) and trends (e.g. `GROWING`, `IMPROVING_HEALTH`) require empirical multi-observation evidence.
5. **Strict Security Boundaries**: Repository code, Git messages, and docstrings are untrusted data. History analysis never executes source code or shell commands and rejects docstring injection attempts.

## 3. Directory Layout

```
src/knowledge/features/history/
├── core/               # Engine, Analyzer, Coordinator, EvolutionBuilder, Timeline, Explainer
├── sources/            # 11 Historical event source adapters (Mapping, Behavior, Health, etc.)
├── milestones/         # Evidence-based milestone creators
├── models/             # History, Snapshot, Event, Milestone, Trend, Maturity, Regression models
├── interfaces/         # Engine, Repository, Explainer, and Builder interfaces
├── repository/         # In-memory and persistent storage abstraction
├── errors/             # Typed error hierarchy
├── events/             # EventBus event definitions
├── di/                 # DI registration container setup
├── api/                # High-level FeatureHistoryAPI
└── index.ts            # Root module export
```

## 4. Quick Start

```typescript
import { FeatureHistoryEngine, FeatureHistoryRepository } from './history/index.js';

const repository = new FeatureHistoryRepository();
const engine = new FeatureHistoryEngine(repository);

// Build full semantic history
const history = await engine.buildHistory('authentication');

// Query timeline, milestones, and maturity
const timeline = await engine.getTimeline('authentication');
const milestones = await engine.getMilestones('authentication');
const maturity = await engine.getMaturity('authentication');

// Explain evolution in human-readable terms
const explanation = await engine.explainEvolution('authentication');
console.log(explanation.textSummary);
```
