# Observation Provenance & Trust Model

## 1. Overview

A critical requirement of Phase 7.6 is the absolute separation of trust levels between observations reported by external agents and ground-truth verified by authoritative system processes.

> **Core Axiom:**
> An external agent reporting `"all tests passed"` is strictly `AGENT_REPORTED`.
> It must **never** be silently converted into `SYSTEM_VERIFIED`.

---

## 2. Source & Provenance Hierarchy

```mermaid
graph TD
    subgraph Trust Hierarchy (Ascending Precedence)
        L0[UNTRUSTED: UNKNOWN source] --> L1[SEMI_TRUSTED: AGENT / TOOL / MCP]
        L1 --> L2[TRUSTED: SYSTEM / REPOSITORY]
        L2 --> L3[AUTHORITATIVE: VERIFICATION Runner]
    end

    AgentReport[Agent claims: pytest passed] -->|Assigns Provenance| L1
    SystemRunner[Verified test runner executes pytest] -->|Assigns Provenance| L3
```

| Source | Trust Level | Verification Status | Precedence Rank | Description |
| :--- | :--- | :--- | :---: | :--- |
| `VERIFICATION` | `AUTHORITATIVE` / `TRUSTED` | `SYSTEM_VERIFIED` | **5** | Independent, deterministic test/build runner results executed in an isolated verification sandbox. |
| `SYSTEM` | `TRUSTED` | `SYSTEM_OBSERVED` | **4** | System-level hooks and core platform processes observing state. |
| `REPOSITORY` | `TRUSTED` | `SYSTEM_OBSERVED` | **3** | Direct git/VCS commit and tag history. |
| `MCP` | `SEMI_TRUSTED` | `AGENT_REPORTED` | **2** | External MCP server integrations and protocol relays. |
| `TOOL` | `SEMI_TRUSTED` | `AGENT_REPORTED` | **2** | Canonical tool protocol execution telemetry reported by client runtime. |
| `AGENT` | `SEMI_TRUSTED` | `AGENT_REPORTED` | **1** | External LLM/agent self-reported claims (e.g., "I fixed the bug"). |
| `UNKNOWN` | `UNTRUSTED` | `UNVERIFIED` | **0** | Unattributed or legacy observation payloads. |

---

## 3. Provenance Data Structure

```typescript
export interface ObservationProvenance {
  readonly source: ObservationSource;
  readonly sourceId?: string | undefined;
  readonly reportedBy: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly trustLevel: ObservationTrustLevel;
  readonly verificationStatus: ObservationVerificationStatus;
}
```

---

## 4. Architectural Rules

1. **Non-destructive Logging**:
   When a trusted observation (`SYSTEM_VERIFIED`) contradicts an agent observation (`AGENT_REPORTED`), the agent's observation is **not** deleted or modified. Both records persist in the observation store.
2. **Precedence in Resolution**:
   When aggregating task status or determining execution success, `SYSTEM_VERIFIED` strictly wins over `AGENT_REPORTED`. The conflicting observation is linked and recorded in `ObservationConflict`.
3. **Auditability**:
   Every observation timeline entry carries its original provenance string and timestamps, preserving complete audit trails for security and compliance reviews.
