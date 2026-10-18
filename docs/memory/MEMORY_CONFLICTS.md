# Memory Conflicts & Contradiction Handling

## 1. Conflict Types

Conflicts arise when different sources assert incompatible statements about the project:
1. **Temporal Conflicts**: An older decision contradicts a newer decision (resolved by `validFrom` / `validUntil` supersession).
2. **Authority Conflicts**: An unverified agent claim contradicts a human architectural decision record.
3. **Cross-Subsystem Conflicts**: Two teams document opposing conventions for shared services.

## 2. Transparent Representation

Contradictory claims are never silently merged or suppressed based on embedding scores. The system constructs a `RetrievalConflict` record containing:
- `resourceId`: The shared target resource.
- `conflictingClaimA`: Statement from first candidate.
- `sourceA` & `authorityA`: Origin and authority of claim A.
- `conflictingClaimB`: Statement from second candidate.
- `sourceB` & `authorityB`: Origin and authority of claim B.
- `resolution`: Formal explanation of why one claim takes precedence over the other based on the authority hierarchy.

This conflict data is returned to callers and context consumers so LLMs and agents can reason about migrations and evolving architectures accurately.
