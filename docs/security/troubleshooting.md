# Phase 8.2 Security Troubleshooting Guide

## 1. Common Issues and Resolutions

### Error: `AuthenticationError: API Key is required`
- **Cause**: In production or test mode, unauthenticated requests are rejected.
- **Resolution**: Pass an `apiKey` or `token` in the request credentials, or configure an active principal in `PrincipalResolver`.

### Error: `ScopeViolationError: Request scope is outside authorized scope`
- **Cause**: The client attempted to access a workspace or repository different from the one bound to its session.
- **Resolution**: Check the client's `SecurityContext`. Ensure the tool arguments (`workspaceId`, `repositoryId`) match the authorized session.

### Error: `PermissionDeniedError: External agents cannot execute arbitrary processes`
- **Cause**: An agent attempted to invoke an administrative or shell execution action.
- **Resolution**: ProjectMind does not permit arbitrary code execution. Use observation reporting (`projectmind_report_execution`) instead.

### Error: `AuthenticationError: External clients cannot claim SYSTEM authentication method`
- **Cause**: An external request explicitly provided `method: 'SYSTEM'`.
- **Resolution**: `SYSTEM` identity is reserved exclusively for internal platform services and cannot be claimed externally.
