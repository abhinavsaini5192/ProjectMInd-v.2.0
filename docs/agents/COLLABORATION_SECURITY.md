# Collaboration Security & Provenance Governance

Security in multi-agent environments requires strict isolation and zero-trust verification. Agents cannot be allowed to elevate their own privileges, forge verification, or access data across workspace boundaries.

---

## 1. Zero Trust Principles

### Separation of Identity, Capability, and Trust
```
Identity ≠ Trust ≠ Capability ≠ Permission ≠ Provenance
```
- An agent having registered identity does not grant it trusted status.
- An agent possessing a capability does not imply authorization to execute it.
- An agent can never mark its own work as `SYSTEM_VERIFIED`.
- Collaboration messages and self-reported progress are treated as untrusted input.

---

## 2. Scope Isolation

Every collaboration operation enforces 3 layers of boundary scoping:
1. **Workspace Scope**: Agents cannot inspect or modify sessions in another workspace.
2. **Project Scope**: Sessions, tasks, and reservations are scoped to an explicit `ProjectId`.
3. **Repository Scope**: Resource reservations are bound to specified repository IDs.

Cross-workspace or cross-project requests trigger `403 INVALID_SCOPE` / `ApiError.invalidScope`.

---

## 3. Provenance & Verification Protection

### Agent-Reported vs System-Verified
- When an agent finishes coding, its completion report is strictly tagged:
  `provenance: AGENT_REPORTED`
- Only independent test harnesses, linters, and verification pipelines executed outside the agent's process can award:
  `provenance: SYSTEM_VERIFIED`
- Tasks cannot transition to `COMPLETED` based solely on agent claims.

---

## 4. Decision Authority & Project Memory Governance

Agent decisions recorded during collaboration start with:
`authority: AGENT_PROPOSED`

An agent can **never** self-promote its proposals to authoritative status.
Promotion pipeline:
```
Agent Proposal (AGENT_PROPOSED)
       │
       ▼
Team Review (TEAM_ACCEPTED)
       │
       ▼
Automated Testing / Build Verification (SYSTEM_VERIFIED)
       │
       ▼
Developer Override / Project Governance (PROJECT_POLICY)
```

Only `TEAM_ACCEPTED`, `SYSTEM_VERIFIED`, or `PROJECT_POLICY` decisions can become permanent Project Memory entries with authoritative standing.
