# Freshness & Version Consistency

## Freshness Model

The API tracks whether knowledge is up-to-date with respect to repository changes and analysis runs.

```typescript
export type FreshnessStatus =
  | 'CURRENT'
  | 'RECENT'
  | 'STALE'
  | 'UNKNOWN'
  | 'NOT_AVAILABLE'
  | 'VERSION_MISMATCH';

export interface FeatureKnowledgeFreshness {
  status: FreshnessStatus;
  lastUpdatedAt?: number | undefined;
  sourceKnowledgeVersion?: string | undefined;
  invalidationReason?: string | undefined;
  ageMs?: number | undefined;
}
```

### Freshness Evaluation Rules
1. **Version Mismatch**: If the client requests a specific `knowledgeVersion` and sections reflect a different version, status is `VERSION_MISMATCH`.
2. **Stale Subsystems**: If any requested section has status `STALE`, overall freshness is `STALE`.
3. **Time-Based Evaluation**:
   - Age < 1 hour: `CURRENT`
   - Age < 24 hours: `RECENT`
   - Older: `STALE`
4. **Enforcing Policy**:
   If query specifies `freshness: 'CURRENT'` and the resolved profile is `STALE`, `FeatureKnowledgeQueryError` is thrown immediately to prevent silent consumption of outdated intelligence.

---

## Version Consistency

Subsystems evolve at different speeds. The API actively audits version consistency across sections:

```typescript
export interface FeatureKnowledgeVersion {
  aggregateVersion: string;
  consistencyStatus: VersionConsistencyStatus; // 'CONSISTENT' | 'PARTIALLY_CONSISTENT' | 'INCONSISTENT' | 'UNKNOWN'
  sectionVersions: Record<string, string>;
  mismatches: string[];
}
```

- `CONSISTENT`: All active sections report the same knowledge version.
- `PARTIALLY_CONSISTENT`: Multiple versions exist across sections, but no explicit mismatch against a requested version.
- `INCONSISTENT`: At least one section contradicts the explicitly requested query knowledge version.
