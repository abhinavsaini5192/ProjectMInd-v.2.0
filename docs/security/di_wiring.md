# Phase 8.2 Dependency Injection & Service Wiring

## 1. Overview

The Security Subsystem is registered into the platform's central `DIContainer` during bootstrap using `SecurityDISetup`.

---

## 2. Security DI Tokens

All tokens are defined in `src/security/di/SecurityTokens.ts`:

- `SecurityTokens.IdentityResolver` $\to$ `IIdentityResolver`
- `SecurityTokens.PrincipalResolver` $\to$ `IPrincipalResolver`
- `SecurityTokens.RoleResolver` $\to$ `IRoleResolver`
- `SecurityTokens.PermissionResolver` $\to$ `IPermissionResolver`
- `SecurityTokens.ScopeValidator` $\to$ `IScopeValidator`
- `SecurityTokens.SecurityPolicyEvaluator` $\to$ `ISecurityPolicyEvaluator`
- `SecurityTokens.Authenticator` $\to$ `IAuthenticator`
- `SecurityTokens.Authorizer` $\to$ `IAuthorizer`
- `SecurityTokens.SecurityContextManager` $\to$ `ISecurityContextManager`
- `SecurityTokens.ToolSecurityAuthorizer` $\to$ `ToolSecurityAuthorizer`
- `SecurityTokens.AuditLogger` $\to$ `IAuditLogger`

---

## 3. Registration in Platform Bootstrap

In `src/platform/bootstrap/ProductionBootstrap.ts`:

```typescript
// 10. Register Services in DI Container
SecurityDISetup.register(container, eventBus);
```

This guarantees that all platform services, tools, and runtimes can resolve security services directly from the DI container.
