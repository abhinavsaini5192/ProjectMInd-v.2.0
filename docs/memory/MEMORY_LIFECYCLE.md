# Project Memory Lifecycle

## 1. Candidate Proposal Pipeline

New information cannot become authoritative memory spontaneously:

```
  Observation / Decision / Postmortem
                  ↓
       ProjectMemoryCandidate
                  ↓
       Review / Evidence Check
                  ↓
       Promotion / Rejection
                  ↓
         Active ProjectMemory
```

### Proposing Candidates
When an agent or background process notices a potential pattern, it calls `manager.proposeCandidate(...)`.
The candidate has status `CANDIDATE` and is held in staging until promoted or rejected.

## 2. Memory States

Defined in [MemoryEnums.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/memory/project/models/MemoryEnums.ts):
- `CANDIDATE`: Staged observation awaiting validation.
- `ACTIVE`: Validated memory currently in effect.
- `SUPERSEDED`: Replaced by a newer decision or migration.
- `DEPRECATED`: Marked as obsolete or discouraged.
- `INVALIDATED`: Proven false, contradicted, or retracted.
- `CONFLICTED`: Contains unresolved disputes across sources.
- `ARCHIVED`: Retained for historical audit only.

## 3. Supersession & Invalidation

When architectural decisions evolve (e.g. moving from Redis to PostgreSQL):
1. The new decision records `validFrom = now`.
2. The old decision transitions to `SUPERSEDED` with `validUntil = now`, `supersededBy = newId`, and an incremented version number.
3. Historical records are preserved; queries with `validAt` can query historical states as of any timestamp.
