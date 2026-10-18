# ProjectMind Agent Security & Anti-Elevation (Phase 8.9)

## 1. Untrusted Agent Principle

ProjectMind treats external AI agents (e.g. Cursor, Windsurf, Devin, Claude Code) as **untrusted or partially trusted clients**.
An agent identity cannot inherit arbitrary user permissions or self-certify its own trust level.

## 2. Anti-Elevation Tenets

1. **Immutable Trust Ranks**:
   - `UNTRUSTED` (Rank 0)
   - `LIMITED` (Rank 1)
   - `STANDARD` (Rank 2)
   - `VERIFIED` (Rank 3)
   - `SYSTEM` (Rank 4)
   Agents operate at `LIMITED` or `STANDARD`. Agents cannot alter their trust rank or assign roles to themselves.

2. **No Provable Self-Attestation**:
   - When an agent reports test results or execution feedback, the evidence is tagged `AGENT_REPORTED`.
   - `ProvenanceValidator` prevents external agents from claiming `SYSTEM_VERIFIED`, `SYSTEM_OBSERVED`, or `CI`.

3. **Capability Sandboxing**:
   - Agents are bound strictly to assigned technical capabilities (`READ_CONTEXT`, `REPORT_EXECUTION`, `UPDATE_KNOWLEDGE`).
   - Tool calls requiring capabilities absent from `agent.capabilities` fail fast with `PermissionDeniedError`.

4. **Task & Session Scope Enforcement**:
   - If an agent is assigned to `task-123` within `ws:mind`, requests referencing other tasks or repositories are denied by `CrossScopeGuard`.
