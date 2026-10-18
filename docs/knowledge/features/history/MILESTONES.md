# Feature Milestones

## 1. Overview

Milestones mark significant evolutionary achievements or shifts in a feature's life cycle. They are derived by `FeatureMilestoneDetector` using empirical multi-source evidence.

## 2. Supported Milestones

| Milestone | Detection Condition | Importance |
| :--- | :--- | :--- |
| `FEATURE_CREATED` | Explicit creation record in repository | CRITICAL |
| `FEATURE_DISCOVERED` | First discovered by ProjectMind discovery engine | HIGH |
| `FEATURE_ACTIVATED` | Status transitions from DISCOVERED/DRAFT to ACTIVE | HIGH |
| `FEATURE_EXPANDED` | $\ge 2$ new resources or new entry points/flows | HIGH |
| `FEATURE_DEPENDENCY_EXPANDED`| First dependent feature declared (e.g. Checkout depends on Auth) | HIGH |
| `FEATURE_BEHAVIOR_EXPANDED` | New end-to-end behavior flows mapped | HIGH |
| `FEATURE_HEALTH_IMPROVED` | Health score improves by $\ge 15$ points | HIGH |
| `FEATURE_RISK_REDUCED` | Risk score decreases by $\ge 15$ points | MEDIUM |
| `FEATURE_RISK_INCREASED`| Risk score escalates by $\ge 15$ points | HIGH |
| `FEATURE_STABILIZED` | Low churn, stable mappings, high health across $\ge 3$ snapshots | HIGH |
| `FEATURE_DEPRECATED` | Explicit deprecation recorded | CRITICAL |

## 3. Evidence-Based Guarantee

Milestones are never hallucinated or assumed. Unsubstantiated text in docstrings or comments (e.g., "Feature is now mature and stable") is treated as untrusted data and discarded without empirical support.
