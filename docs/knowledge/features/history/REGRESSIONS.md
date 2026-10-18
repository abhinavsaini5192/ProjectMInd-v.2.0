# Feature Regressions

## 1. Overview

A regression represents an adverse shift in a feature's health, risk, or functional integrity between snapshots.

## 2. Detected Regression Types

1. **`HEALTH_DECLINE`**:
   - Health score drops by $\ge 15$ points between snapshots.
   - Severity: `MEDIUM` (15-29 points) or `HIGH` ($\ge 30$ points).

2. **`RISK_ESCALATION`**:
   - Risk score spikes by $\ge 20$ points (e.g. unhandled external dependency introduced).
   - Severity: `HIGH`.

3. **`BEHAVIOR_FLOW_REMOVED`**:
   - A previously verified execution flow disappears without planned deprecation.
   - Severity: `HIGH`.

4. **`UNVERIFIED_CRITICALITY_INCREASE`**:
   - A feature becomes depended upon by more features (criticality increases), but its health score drops.
   - Severity: `MEDIUM`.

## 3. Evidence Preservation

Every detected regression includes structured before and after values, timestamp, severity, and evidence indicators.
