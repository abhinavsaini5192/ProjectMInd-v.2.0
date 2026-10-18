# Feature Comparisons

## 1. Overview

`FeatureComparison` allows developers and AI agents to perform granular before/after diffs between two points in a feature's life cycle.

## 2. Comparison Targets

Comparisons can be executed across:
- **Snapshots**: By specific `snapshotId`
- **Semantic Versions**: By integer version numbers (e.g. v1 vs v2)
- **Timestamps**: By epoch timestamps, matching nearest snapshot before each timestamp

## 3. Comparison Dimensions

A comparison evaluates:
- `mappingsAdded` / `mappingsRemoved`
- `dependenciesAdded` / `dependenciesRemoved`
- `flowsAdded` / `flowsRemoved`
- `entryPointsAdded` / `entryPointsRemoved`
- `healthDelta` (before, after, net delta)
- `riskDelta` (before, after, net delta)
- `criticalityChange` (beforeLevel, afterLevel)
- `architectureChanges` (layer moves, pattern shifts)
- `milestonesCrossed`
