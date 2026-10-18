# ProjectMind Knowledge Security & Provenance Validation (Phase 8.9)

## 1. Knowledge State Protection

ProjectMind's persistent knowledge graph contains architecture maps, feature descriptions, dependencies, and historical evolution.
- **Scope-Aware Access**: Every query into feature intelligence is gated by workspace and repository scopes.
- **Non-Destructive Evolution**: Knowledge updates require atomic version incrementation. Interrupted or conflicting updates trigger optimistic concurrency errors rather than corrupting state.

## 2. Provenance Integrity

External agents frequently submit knowledge update suggestions after completing coding tasks.
- **Rule**: Untrusted or interactive agents cannot claim `SYSTEM_VERIFIED`, `SYSTEM_OBSERVED`, `CI`, `ADMIN`, or `SECURITY_APPROVED`.
- `ProvenanceValidator` checks the caller's `SecurityPrincipal`. Any non-system caller claiming system provenance is rejected with `InvalidProvenanceError`.
- Unverified updates remain flagged as `AGENT_REPORTED` until confirmed by independent static analysis or test verification pipelines.
