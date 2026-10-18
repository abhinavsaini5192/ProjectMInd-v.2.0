# ProjectMind API Security Architecture & Policies

## 1. Security Philosophy & Principles

The ProjectMind API layer is engineered under a strict **Zero-Trust, Default-Deny** paradigm. All endpoints (except public health checks and capabilities discovery) require explicit authentication and fine-grained authorization.

### Fundamental Security Axioms
1. **No Duplicate Security Logic**: The API layer never implements custom credential verification, password hashing, or token decoding. It delegates 100% of identity verification and policy evaluation to the canonical Phase 8.2 security engines:
   - [`IAuthenticator`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/interfaces/IAuthenticator.ts)
   - [`IAuthorizer`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/interfaces/IAuthorizer.ts)
   - [`ISecurityContextManager`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/interfaces/ISecurityContextManager.ts)
2. **Default Deny**: Unless a route explicitly declares itself public, or an authenticated principal has explicit permission to execute the requested action on the target resource within the tenant boundary, the request is rejected with `401 UNAUTHENTICATED` or `403 FORBIDDEN`.
3. **Defense in Depth**: Security checks are performed across multiple pipeline layers:
   - *Transport & Network*: TLS termination, IP rate limiting.
   - *Identity*: Credential extraction and verification.
   - *Policy*: RBAC / ABAC action validation.
   - *Scope*: Workspace & repository boundary verification (IDOR protection).
   - *Data Validation*: Strict schema validation on inbound payloads.
   - *Egress Sanitization*: Secret redaction from errors, headers, and logs.

---

## 2. Authentication Flow

Authentication is executed by [`AuthenticationMiddleware`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/middleware/AuthenticationMiddleware.ts) during request processing:

```
[Inbound Request]
        │
        ▼
Extract Credentials from Headers
  ├── "x-api-key: pm_..."
  ├── "Authorization: Bearer <jwt | token>"
  └── "x-service-id" & "x-service-secret"
        │
        ▼
Delegate to IAuthenticator.authenticate(input)
  ├── Success: Returns SecurityPrincipal & TrustLevel
  └── Failure: Throws ApiError.unauthenticated (401)
        │
        ▼
Delegate to ISecurityContextManager.createContext(principal, options)
  └── Attaches verified SecurityContext to RequestContext
```

### Supported Authentication Methods

| Method | Header Format | Typical Principal | Usage |
|---|---|---|---|
| **API Key** | `x-api-key: pm_live_...` or `Authorization: Bearer pm_live_...` | User / Service | CLI, IDE Extensions, CI/CD |
| **Bearer JWT** | `Authorization: Bearer eyJhbG...` | Federated User | Web Dashboard, OAuth2 Providers |
| **Service Credentials** | `x-service-id: svc-1` + `x-service-secret: ...` | Internal Service | Mesh Services, Background Daemons |
| **Development Bypass** | `x-dev-principal-id: dev-user` | Developer Principal | Local unit tests / dev mode only |

---

## 3. Authorization & RBAC/ABAC Evaluation

Authorization is enforced per-route by [`AuthorizationMiddleware`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/middleware/AuthorizationMiddleware.ts) using declarative route metadata:

```typescript
router.delete(
  '/v1/features/:id',
  featureController.deleteFeature,
  {
    middlewares: [
      createAuthorizationMiddleware({
        authorizer: container.resolve(SecurityTokens.Authorizer),
        action: 'DELETE',
        resourceType: 'FEATURE',
      })
    ]
  }
);
```

### Evaluation Protocol
1. Resolves `principal` and `securityContext` from `request.context`.
2. Extracts target `resourceId` from URL route params (`:id`, `:featureId`, `:sessionId`).
3. Assembles an [`AuthorizationRequest`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/interfaces/IAuthorizer.ts):
   ```typescript
   const authzRequest: AuthorizationRequest = {
     principal,
     action: 'DELETE',
     resourceType: 'FEATURE',
     resourceId: 'feat-123',
     scope: { workspaceId: 'ws-prod', repositoryId: 'repo-prod' },
     context: securityContext,
   };
   ```
4. Invokes `IAuthorizer.authorize(authzRequest)`.
5. If `allowed === false`, execution halts immediately with `403 FORBIDDEN` and an RFC 7807 error detail explaining the denial policy.

---

## 4. Multi-Tenant Scope Validation & IDOR Prevention

Insecure Direct Object Reference (IDOR) attacks are completely mitigated by [`ScopeValidationMiddleware`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/middleware/ScopeValidationMiddleware.ts).

### Boundary Verification Rules:
1. Every authenticated context is scoped to a specific `workspaceId` (and optional `repositoryId`).
2. If a request includes workspace or repository IDs in headers (`x-workspace-id`, `x-repository-id`) or URL path parameters (`/workspaces/:workspaceId/...`), the middleware compares them with the authenticated `securityContext.workspaceId`.
3. If a mismatch is detected, the request is instantly rejected with `403 FORBIDDEN` before any domain service or database query is executed:
   ```json
   {
     "type": "https://projectmind.ai/errors/forbidden",
     "title": "Cross-Scope Access Denied",
     "status": 403,
     "code": "FORBIDDEN",
     "detail": "Cross-scope access denied: Target workspace 'ws-victim' does not match security context 'ws-attacker'."
   }
   ```

---

## 5. Secret Redaction & Log Sanitization

To prevent accidental data exfiltration through error payloads, logs, or debugging headers:
- All error serialization goes through [`ApiErrorMapper`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/errors/ApiErrorMapper.ts) using the platform [`SecretRedactor`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/platform/security/SecretRedactor.ts).
- Sensitive headers (`authorization`, `x-api-key`, `x-service-secret`, `cookie`) are scrubbed from telemetry spans, logs, and response headers.
- Stack traces and internal database exception details are completely suppressed in production environments (`env === 'production'`).

---

## 6. Rate Limiting & Denial of Service Protection

Rate limiting is enforced by [`RateLimitMiddleware`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/middleware/RateLimitMiddleware.ts) via sliding-window / token-bucket algorithms:
- **Default Policy**: 100 requests per 60-second window per principal.
- **Anonymous Policy**: 20 requests per 60-second window per client IP.
- **Mutating Policy**: 30 mutations per 60-second window for resource creation or heavy orchestration operations.

When exceeded, the API responds with `429 TOO_MANY_REQUESTS` accompanied by a `Retry-After: <seconds>` header and rate limit reset metadata.
