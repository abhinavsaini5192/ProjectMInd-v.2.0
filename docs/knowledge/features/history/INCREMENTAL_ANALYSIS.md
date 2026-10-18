# Incremental History Updates & Rebuilds

## 1. Execution Modes

The history engine supports three execution modes:

1. **`FULL`**:
   - Collects all available events across all registered sources.
   - Reconstructs complete snapshots, timeline, and trends.

2. **`INCREMENTAL`**:
   - Accepts new incoming `FeatureHistoryEvent[]`.
   - Filters events to only affected feature IDs.
   - Appends events to feature timelines and updates cache.
   - Unaffected features are not re-analyzed or invalidated.

3. **`REBUILD`**:
   - Clears in-memory caches.
   - Rebuilds the feature timeline and milestones from scratch using raw persisted events.

## 2. Invalidation Strategy

When an incremental update occurs:
- The in-memory cache for touched feature IDs is invalidated.
- New events are persisted to `FeatureHistoryRepository`.
- `FeatureHistoryEvents.IncrementalUpdated` is published on the EventBus.
