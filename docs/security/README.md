# ProjectMind Production Security, Compliance & Governance (Phase 8.9)

This directory documents the production security, compliance, and governance architecture established in **Phase 8.9** of ProjectMind.

## 1. System Overview

ProjectMind enforces a centralized, deterministic, defense-in-depth security architecture across all system entry points and layers:

```
                 Identity
                    ↓
             Authentication
                    ↓
             Security Context
                    ↓
              Authorization
                    ↓
             Scope Validation
                    ↓
             Capability Check
                    ↓
               Operation
                    ↓
             Audit / Telemetry
```

Security is never delegated to AI reasoning or client-provided metadata. All decisions fail closed by default.

## 2. Core Security Principles

1. **Default Deny**: Every resource and tool call is blocked unless explicitly authorized.
2. **Least Privilege**: Roles, agents, and workers receive the minimum permissions necessary.
3. **Explicit Scope**: All requests require explicit workspace and repository binding.
4. **Defense in Depth**: Security checks are performed at API, domain, storage, and worker layers.
5. **No Provable Forgery**: External agents cannot assert system or CI provenance.
6. **Data vs Instruction Boundary**: Repository content (READMEs, issues, comments) is strictly inert data and cannot override security rules.

## 3. Security Documentation Index

| Document | Focus & Scope |
| :--- | :--- |
| [THREAT_MODEL.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/THREAT_MODEL.md) | Comprehensive 24-point production threat model |
| [SECURITY_ARCHITECTURE.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/SECURITY_ARCHITECTURE.md) | Defense-in-depth architecture, boundaries, and security context |
| [AUTHENTICATION.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/AUTHENTICATION.md) | Credential verification, session security, and rotation rules |
| [AUTHORIZATION.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/AUTHORIZATION.md) | RBAC matrix, permission resolution, and default deny semantics |
| [AGENT_SECURITY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/AGENT_SECURITY.md) | Agent trust boundaries, anti-elevation rules, and capability constraints |
| [MCP_SECURITY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/MCP_SECURITY.md) | MCP adapter security, tool authorization, and parameter sanitization |
| [API_SECURITY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/API_SECURITY.md) | Input validation, IDOR defense, and secure error handling |
| [CONTEXT_SECURITY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/CONTEXT_SECURITY.md) | Scope-bounded context generation and isolated cache partitioning |
| [KNOWLEDGE_SECURITY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/KNOWLEDGE_SECURITY.md) | Provenance validation and protection against knowledge corruption |
| [VERIFICATION_SECURITY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/VERIFICATION_SECURITY.md) | Evidence provenance verification (agent vs system vs CI) |
| [SECRETS.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/SECRETS.md) | Secret scanning, pre-log redaction, and vault references |
| [DATA_CLASSIFICATION.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/DATA_CLASSIFICATION.md) | Data handling policies across 5 classification levels |
| [AUDIT.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/AUDIT.md) | Append-only audit logging and non-repudiation guarantees |
| [INCIDENT_RESPONSE.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/INCIDENT_RESPONSE.md) | Incident categories, containment actions, and resolution workflows |
| [SECURITY_TESTING.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/SECURITY_TESTING.md) | Security regression test suite covering sections A through M |
| [SECURITY_CONFIGURATION.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/security/SECURITY_CONFIGURATION.md) | Startup security validation and environment boundary enforcement |

## 4. Security Modules Reference

- Data Classification: [DataClassification.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/governance/DataClassification.ts)
- Credential Lifecycle: [CredentialLifecycle.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/governance/CredentialLifecycle.ts)
- Security Config Validator: [SecurityConfigValidator.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/governance/SecurityConfigValidator.ts)
- Incident Management: [SecurityIncidentManager.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/incident/SecurityIncidentManager.ts)
- Session Management: [SessionManager.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/session/SessionManager.ts)
- Secret Scanner: [SecretScanner.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/hardening/SecretScanner.ts)
- Provenance Validator: [ProvenanceValidator.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/hardening/ProvenanceValidator.ts)
- Prompt Injection Guard: [PromptInjectionGuard.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/hardening/PromptInjectionGuard.ts)
- Cross-Scope Guard: [CrossScopeGuard.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/hardening/CrossScopeGuard.ts)
