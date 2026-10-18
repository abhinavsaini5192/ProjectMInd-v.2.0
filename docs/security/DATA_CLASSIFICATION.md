# ProjectMind Data Classification & Handling Policies (Phase 8.9)

## 1. Classification Levels

ProjectMind classifies all stored, processed, and transmitted data across 5 discrete levels:

| Level | Sensitivity | Can Log? | Can Expose Cross-Scope? | Encryption Required? | Typical Data Assets |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `PUBLIC` | Lowest | **YES** | **YES** | No | Public documentation, release notes, open-source repo metadata |
| `INTERNAL` | Low | **YES** | **NO** | No | Internal platform health metrics, agent capability definitions |
| `CONFIDENTIAL` | Medium | **YES** | **NO** | **YES** | Source code content, feature intelligence, context packages |
| `SENSITIVE` | High | **NO** | **NO** | **YES** | Audit trails, security violation logs, user identity profiles |
| `SECRET` | Critical | **NO** | **NO** | **YES** | Cryptographic private keys, database passwords, session tokens |

## 2. Handling & Exposure Rules

1. **SECRET Handling**: Plaintext secrets are strictly prohibited from appearing in log streams, metrics, telemetry spans, or error payloads.
2. **SENSITIVE Handling**: Audit records are write-once, append-only, and restricted to platform security administrators.
3. **CONFIDENTIAL Handling**: Strictly scoped to the owning workspace and repository. Gated by `CrossScopeGuard`.
