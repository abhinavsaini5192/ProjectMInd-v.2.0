# Phase 8.2 Developer Security Checklist

## 1. Golden Rules for Developers & Contributors

Before submitting any code changes to ProjectMind, verify adherence to the following:

- [ ] **Default Deny**: Does the new endpoint, tool, or service fail closed if no explicit authorization is provided?
- [ ] **Deterministic Authorization**: Are all permission checks done via `IAuthorizer` or `IScopeValidator`? Never use an LLM or prompt heuristic for access control.
- [ ] **Scope Enforcement**: When handling resources, is the resource's `workspaceId` and `repositoryId` verified against the caller's `SecurityContext`?
- [ ] **Anti-Elevation**: Are external agent observations strictly tagged as `AGENT_REPORTED`? Does your code prevent agents from claiming `SYSTEM_VERIFIED` status?
- [ ] **Zero Shell Execution**: Ensure no `child_process.exec`, `spawn`, or shell commands are invoked by external agents.
- [ ] **Secret Sanitization**: Are credentials, tokens, or passwords passed through `LogRedactor` or `ToolSecurityAuthorizer.sanitizeToolParameters`?
- [ ] **Immutable Audit Logging**: Does your critical operation call `IAuditLogger.logEvent` with appropriate event metadata?
