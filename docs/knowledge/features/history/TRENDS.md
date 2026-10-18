# Feature Trends & Growth Metrics

## 1. Multi-Observation Rule

Trends cannot be reliably inferred from a single snapshot. `FeatureTrendAnalyzer` enforces a strict prerequisite:
- At least **two distinct snapshots** are required to establish a trend.
- A single observation defaults to `UNKNOWN` with low confidence.

## 2. Supported Trend Types

- `GROWING`: Resource footprint and flows consistently expanding
- `SHRINKING`: Resource footprint reducing
- `STABLE`: Consistent mappings and low resource churn
- `INCREASING_COMPLEXITY`: Rapid branching in flows and symbols
- `INCREASING_COUPLING`: Growth in dependencies
- `IMPROVING_HEALTH`: Positive health score trajectory ($\ge 10$ points)
- `DECLINING_HEALTH`: Negative health score trajectory ($\le -10$ points)
- `INCREASING_RISK`: Escalating risk factors ($\ge 10$ points)
- `DECLINING_RISK`: Risk reduction ($\le -10$ points)
- `INCREASING_CRITICALITY`: Feature became a core dependency for other features
- `INCREASING_VERIFICATION`: Tests and verification quality expanding

## 3. Growth Metrics

Growth metrics record current and previous values, net delta, and normalized percentage growth:
- `resourceCount`
- `flowCount`
- `dependencyCount`
- `dependentCount`
- `healthScore`
- `riskScore`
