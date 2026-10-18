# Feature Maturity Model

## 1. Overview

Feature maturity assesses the stability, verification, and integration health of a feature. 
Crucially: **Age alone does not equal maturity**. An old, untested, high-risk feature is not mature.

## 2. Maturity Levels

- `UNKNOWN`: Insufficient snapshot data
- `NASCENT`: Newly discovered, high churn, low test coverage
- `DEVELOPING`: Expanding functionality, partial verification
- `ESTABLISHED`: Consistent mappings, dependable health ($\ge 65/100$)
- `MATURE`: Stable across $\ge 3$ snapshots, comprehensive verification ($\ge 80/100$), low risk ($\le 20/100$)
- `DEPRECATED`: Explicitly marked deprecated

## 3. Composite Scoring Factors

Maturity is calculated using weighted dimensions:
1. **Stability Score** (35%): Low churn and low risk profile
2. **Verification Score** (30%): Phase 6.6 verification quality and health
3. **Mapping Confidence** (20%): Certainty of code-to-feature mapping
4. **Dependency Stability** (15%): Proven integration by dependents
