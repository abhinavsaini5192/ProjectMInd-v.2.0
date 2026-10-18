# Knowledge Conflict Handling & Precedence

## Conflict Detection

Conflicts arise when disparate sources produce contradictory claims regarding the repository state or feature behavior:

1. **Verification vs. Agent Claims**: An external agent reports successful task completion, but automated verification (test runner, build compiler) reports failure.
2. **Concurrent Modifications**: Two concurrent tasks modify overlapping feature surfaces with conflicting assumptions.
3. **Stale Observation Race**: An observation reflects a prior commit or file state that has already been superseded.

```typescript
export interface KnowledgeUpdateConflict {
  readonly conflictId: string;
  readonly updateId: string;
  readonly conflictType: 
    | 'VERIFICATION_CONFLICT'
    | 'CONCURRENT_MODIFICATION'
    | 'SOURCE_DISCREPANCY'
    | 'SCHEMA_MISMATCH'
    | 'STATE_INCONSISTENCY';
  readonly conflictingSources: readonly string[];
  readonly evidence: readonly KnowledgeUpdateReference[];
  readonly affectedKnowledgeAreas: readonly KnowledgeArea[];
  readonly confidence: number;
  readonly resolutionStatus: 'PENDING' | 'RESOLVED_PRECEDENCE' | 'RESOLVED_MANUAL' | 'RESOLVED_MERGE' | 'DISCARDED';
  readonly resolutionRationale?: string | undefined;
  readonly detectedAt: number;
}
```

## Resolution Precedence Hierarchy

Conflicts are resolved deterministically according to strict source provenance authority:

$$\text{SYSTEM\_VERIFIED} > \text{MANUALLY\_CONFIRMED} > \text{SYSTEM\_OBSERVED} > \text{DERIVED} > \text{AGENT\_REPORTED} > \text{INFERRED}$$

### Key Invariants:

1. **Verification Precedence**: Automated verification evidence (`SYSTEM_VERIFIED`) always overrides unverified agent claims (`AGENT_REPORTED`).
2. **Audit Preservation**: Conflicts are never deleted or ignored. They are stored via `saveConflict(...)` in the repository with complete rationale for diagnostic tracking.
3. **Graceful Degradation**: If an agent claims a feature is healthy but test suites fail, the feature health score is recalculated downwards in accordance with the failing verification evidence.
