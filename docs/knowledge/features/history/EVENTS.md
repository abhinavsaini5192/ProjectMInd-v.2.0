# Feature History Events & Evolution Types

## 1. Event Types

Supported `FeatureHistoryEventType` values:

| Event Type | Category | Description |
| :--- | :--- | :--- |
| `FEATURE_CREATED` | Lifecycle | Feature was initially created or registered |
| `FEATURE_DISCOVERED` | Lifecycle | Feature was discovered by repository inspection |
| `FEATURE_RENAMED` | Lifecycle | Feature display name changed |
| `FEATURE_STATUS_CHANGED` | Lifecycle | Feature state changed (e.g. DRAFT to ACTIVE) |
| `FEATURE_METADATA_CHANGED`| Metadata | Ownership, description, or tags updated |
| `FEATURE_MAPPING_ADDED` | Mapping | New code resource mapped to feature |
| `FEATURE_MAPPING_REMOVED`| Mapping | Code resource unmapped from feature |
| `FEATURE_MAPPING_CHANGED`| Mapping | Mapping role or primary path changed |
| `FEATURE_DEPENDENCY_ADDED`| Topology | New outgoing dependency declared |
| `FEATURE_DEPENDENCY_REMOVED`| Topology | Outgoing dependency removed |
| `FEATURE_DEPENDENCY_CHANGED`| Topology | Dependency contract or version changed |
| `FEATURE_BEHAVIOR_ADDED` | Behavior | New behavioral execution flow mapped |
| `FEATURE_BEHAVIOR_CHANGED`| Behavior | Existing flow steps or participants changed |
| `FEATURE_BEHAVIOR_REMOVED`| Behavior | Behavioral flow removed |
| `FEATURE_ENTRY_POINT_ADDED`| Interface | New API route or CLI entry point added |
| `FEATURE_ENTRY_POINT_REMOVED`| Interface | Entry point removed |
| `FEATURE_HEALTH_CHANGED` | Quality | Health assessment score changed |
| `FEATURE_RISK_CHANGED` | Risk | Risk assessment score or risk factor changed |
| `FEATURE_CRITICALITY_CHANGED`| Topology | Feature criticality score escalated or lowered |
| `FEATURE_ARCHITECTURE_CHANGED`| Structure | Layer, module, or pattern altered |
| `FEATURE_IMPACT_CHANGED` | Impact | Impact radius or propagation altered |
| `FEATURE_EXPANDED` | Scope | Significant growth across resources and flows |
| `FEATURE_CONTRACT_CHANGED`| Contract | Public API schema or interface changed |
| `FEATURE_DEPRECATED` | Lifecycle | Marked as deprecated |
| `FEATURE_REACTIVATED` | Lifecycle | Deprecated feature reactivated |
| `FEATURE_DELETED` | Lifecycle | Marked as deleted |
| `FEATURE_REGRESSION_DETECTED`| Quality | Health drop, risk spike, or flow loss |
| `FEATURE_STABILIZED` | Quality | Low churn and stable verified behavior |
| `TECHNICAL_CHANGE` | VCS | Non-semantic commit (formatting, linting) |

## 2. Evolution Types

- `CREATION`: First inception
- `DISCOVERY`: Discovery by engine
- `STRUCTURAL`: Mapping and resource changes
- `BEHAVIORAL`: Execution flow changes
- `DEPENDENCY`: Upstream or downstream dependency changes
- `API`: Route, endpoint, and signature changes
- `DATA`: Persistence model updates
- `INTEGRATION`: Third-party integration updates
- `SECURITY`: Authentication, authorization, cryptography
- `HEALTH`: Verification quality and health
- `RISK`: Risk profile shifts
- `ARCHITECTURAL`: System layering or pattern changes
- `MATURITY`: Maturity level transitions
- `STATUS`: Activation or lifecycle transitions
- `DEPRECATION`: Deprecation notices
- `REGRESSION`: Quality regressions
- `STABILIZATION`: Stabilization milestones
- `TECHNICAL`: Purely technical non-semantic updates
