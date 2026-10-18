# Context Relevance & Scoring Subsystem

## Multi-Factor Scoring Methodology

ProjectMind utilizes an evidence-grounded scoring algorithm (`src/context/selection/ContextRelevanceScorer.ts`) that scores both features and individual mapped resources on a 0.0 to 1.0 scale.

### 1. Feature Relevance Score

$$\text{Score} = (w_d \cdot D) + (w_t \cdot T) + (w_r \cdot R) + (w_f \cdot F) + (w_c \cdot C)$$

Where:
- **$D$ (Directness, weight 0.35)**: 1.0 if explicitly requested or matched in task intent; 0.5 if discovered via dependency graph traversal.
- **$T$ (Task Alignment, weight 0.25)**: 1.0 if feature name is present in task prompt; 0.8 if description matches; 0.5 default.
- **$R$ (Role Importance, weight 0.20)**: 1.0 for direct targets; 0.6 for supporting dependencies.
- **$F$ (Flow Participation, weight 0.10)**: 0.7 if feature participates in a primary execution flow.
- **$C$ (Criticality, weight 0.10)**: Derived from the feature's health criticality score.

### 2. Resource Relevance Score

$$\text{Score} = (w_d \cdot D_{\text{res}}) + (w_t \cdot T_{\text{res}}) + (w_r \cdot R_{\text{res}}) + (w_f \cdot F_{\text{res}}) + (w_c \cdot C_{\text{res}})$$

- **Directness ($D_{\text{res}}$, weight 0.40)**: 1.0 if explicitly modified or listed in `changedResources`; 0.8 if primary resource of direct target; 0.4 otherwise.
- **Role Weight ($R_{\text{res}}$, weight 0.20)**: 1.0 for PRIMARY/ENTRY_POINT; 0.8 for SECONDARY; 0.6 for TEST; 0.4 for SUPPORTING.
- **Task Alignment ($T_{\text{res}}$, weight 0.25)**: Inherited from parent feature relevance or 1.0 if modified.
- **Flow Participation ($F_{\text{res}}$, weight 0.10)**: 0.9 if entrypoint; 0.6 otherwise.
- **Criticality ($C_{\text{res}}$, weight 0.05)**: Inherited from parent feature health.

### 3. Deduplication

When multiple features reference the same physical file or symbol:
- `ContextDeduplicator` groups by `filePath ?? resourceId`.
- Retains the instance with the highest relevance score and priority.
- Merges justifications into reasons array.
