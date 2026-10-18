# ProjectMind Production Threat Model (Phase 8.9)

This document outlines the concrete threat model for ProjectMind, covering 24 critical threat vectors across the entire platform lifecycle.

## 1. Threat Scenarios & Mitigations Matrix

| # | Threat Scenario | Attack Vector / Impact | System Defense & Mitigation | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Compromised User** | Stolen user API key or session cookie | Session revocation via `SessionManager`, credential rotation, audit logging | `IMPLEMENTED` |
| **2** | **Compromised Agent** | Hostile AI model or hijacked adapter | Anti-elevation policies, limited capabilities, `AGENT_REPORTED` trust cap | `IMPLEMENTED` |
| **3** | **Malicious Repository** | Injected exploit in scanned source code | Files parsed as AST in isolated worker; no raw shell execution of repository scripts | `IMPLEMENTED` |
| **4** | **Malicious Documentation** | Phishing or injection embedded in docs | Markdown sanitized; instructions treated strictly as inert data | `IMPLEMENTED` |
| **5** | **Prompt Injection** | "Ignore previous rules" in comments/issues | `PromptInjectionGuard` neutralizes directives and encapsulates in `<untrusted_content>` | `IMPLEMENTED` |
| **6** | **Forged Verification** | Agent claims fake passing test suite | `ProvenanceValidator` rejects agent asserting `CI` or `SYSTEM_VERIFIED` | `IMPLEMENTED` |
| **7** | **Forged Provenance** | Client claims internal system identity | Strict principal verification; non-system principals cannot assert system provenance | `IMPLEMENTED` |
| **8** | **Stolen Credential** | Leaked bearer token used by adversary | `CredentialLifecycleManager` marks `COMPROMISED` and immediately blocks authentication | `IMPLEMENTED` |
| **9** | **Leaked Token in Logs** | Accidental dump of API key in trace/log | `SecretScanner` and `LogRedactor` redact keys pre-ingestion | `IMPLEMENTED` |
| **10** | **Cross-Workspace Access** | Tenant A queries Tenant B features | `CrossScopeGuard` enforces workspace containment; fails closed | `IMPLEMENTED` |
| **11** | **Cross-Repository Access** | Tenant A user queries restricted repo | Strict repository scope checks in `CrossScopeGuard` and `ScopeValidator` | `IMPLEMENTED` |
| **12** | **Privilege Escalation** | Developer principal attempts policy write | Default deny in `AuthorizationService`; requires explicit `ADMIN` permission | `IMPLEMENTED` |
| **13** | **Malicious MCP Client** | Unauthorized tool invocation | `ToolSecurityAuthorizer` checks both technical capabilities and RBAC permissions | `IMPLEMENTED` |
| **14** | **Malicious API Client** | IDOR and malformed payload injection | Strict schema validation, query parameter sanitization, and scope gating | `IMPLEMENTED` |
| **15** | **Job Queue Poisoning** | Malformed or unauthorized job submitted | Job dispatcher validates caller scope and payload before enqueueing | `IMPLEMENTED` |
| **16** | **Event Poisoning** | External injection of internal system event | Ingestion boundary isolates external webhooks from internal EventBus topics | `IMPLEMENTED` |
| **17** | **Cache Leakage** | Tenant A reads Tenant B cached context | `CrossScopeGuard.buildScopedCacheKey` namespaces all keys with `ws:{workspaceId}:` | `IMPLEMENTED` |
| **18** | **Stale Authorization** | Permissions revoked but caller still acts | Short-lived security contexts and instant session invalidation via `invalidateAllForIdentity` | `IMPLEMENTED` |
| **19** | **Session Hijacking** | Replay of stolen session token | Idle timeouts, IP/user-agent correlation, and explicit revocation APIs | `IMPLEMENTED` |
| **20** | **Recovery Abuse** | Unauthorized destructive database restore | `BackupRestoreValidator` requires valid `authorizedBy`; exclusive scope locking | `IMPLEMENTED` |
| **21** | **Data Deletion Abuse** | Hostile bulk purge of repository data | Automated recovery explicitly prohibited from deleting unknown or corrupted data | `IMPLEMENTED` |
| **22** | **Dependency Compromise** | Malicious package injected in supply chain | Zero untrusted runtime dependencies; lockfiles enforced; strict type-checking | `IMPLEMENTED` |
| **23** | **Supply-Chain Compromise** | Poisoned build or npm dependency | Production dependencies audited; pinned versions; no arbitrary script execution | `IMPLEMENTED` |
| **24** | **Telemetry Leakage** | Confidential source code leaked to metrics | `DataClassification` enforces no logging for `SECRET` and `SENSITIVE` categories | `IMPLEMENTED` |
