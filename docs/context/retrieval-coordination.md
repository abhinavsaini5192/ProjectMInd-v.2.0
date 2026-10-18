# Retrieval Coordination Subsystem

## Overview

The Retrieval Subsystem (`src/context/retrieval/`) acts as the read-only data aggregator for the Context Orchestrator. It coordinates calls to Phase 6.9 `IFeatureKnowledgeAPI` and repository indexes without duplicating feature discovery or parsing logic.

## Coordinators & Retrievers

### 1. `ContextRetrievalCoordinator`
- Implements `IContextRetriever`.
- Resolves target features dynamically if not explicitly specified.
- Coordinates batched retrieval of feature profiles, dependency trees, and change impacts.
- Aggregates missing-feature and provider failure warnings into `ContextWarning[]`.

### 2. `FeatureContextRetriever`
- Takes target feature IDs and `maxDepth`.
- Retrieves each feature's complete knowledge profile via `api.getFeatureKnowledge()`.
- Recursively inspects outgoing dependencies up to `maxDepth`.
- Distinguishes direct target features from dependency features.

### 3. `ResourceContextRetriever`
- Maps file paths and resource IDs to feature IDs using `IFeatureMappingRepository.getResourceFeatures()` and `IFeatureRepository.findByReference()`.
- Enables context queries driven by Git changes (`changedResources`).

### 4. `TaskContextRetriever`
- Resolves feature candidates by matching developer prompt keywords (`taskText`) and structured task metadata (`taskIntent`) against feature names and tags.

### 5. `ImpactContextRetriever`
- For direct target features and changed files, gathers blast radius and affected feature information via `api.getFeatureImpact()`.
