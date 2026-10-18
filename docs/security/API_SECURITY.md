# ProjectMind API Security & Insecure Direct Object Reference (IDOR) Defense (Phase 10.8)

## 1. Boundary Defenses

All incoming HTTP requests to ProjectMind pass through strict API security filters:
1. **Authentication Middleware**: Resolves caller API key or session token; rejects unauthenticated requests. In production/staging, `x-dev-principal-id` header bypass is strictly rejected with HTTP 401.
2. **Schema & Input Validation**: Validates payload shape, property types, and string constraints using Zod schemas.
3. **Payload Size Limits**: Max request body bounded (default 10MB; jobs 512KB) to mitigate denial-of-service attempts. Streaming sockets are destroyed if thresholds are exceeded.
4. **Idempotency Enforcement**: Prevents duplicate executions of mutating operations using idempotency keys.
5. **Enterprise Security Headers**: Every HTTP response sets:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `Content-Security-Policy: default-src 'self'`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `X-XSS-Protection: 0`
6. **CORS Hardening**: Origin validation reflects allowed origins explicitly. Under W3C CORS specifications, wildcard origin (`*`) with `allowCredentials: true` is strictly prohibited.

---

## 2. Insecure Direct Object Reference (IDOR) Defense

An attacker who is validly authenticated in Workspace A might attempt to access a feature or context belonging to Workspace B by forging resource identifiers in URL parameters or request bodies:

```http
POST /api/v1/context
{
  "workspaceId": "ws-victim",
  "featureId": "feat-confidential"
}
```

- **Protection**: `CrossScopeGuard.assertScopeAccess` compares the target resource's parent scope against `SecurityContext.scope`.
- Even if the caller supplies a valid resource ID, if the resource belongs to another workspace, the request is immediately rejected with `CrossScopeViolationError` (`403 Forbidden`).
- **Cache Isolation**: Cache keys are automatically prefixed with tenant scope via `CrossScopeGuard.buildScopedCacheKey`: `ws:{workspaceId}:repo:{repositoryId}:{key}`.

---

## 3. Secure Error Handling & Secret Redaction

API error responses return standardized, safe error payloads conforming to RFC 7807 (Problem Details):
- **No Stack Traces**: Stack traces are logged internally with correlation IDs but omitted from HTTP response bodies.
- **Redaction of Leaked Secrets**: `ApiErrorMapper` passes all error messages and details through `ConfigRedactor.redactString()`, ensuring that database passwords, bearer tokens, or API keys embedded in exceptions are replaced with `[REDACTED]` before leaving the server boundary.
- **No Internal Hostnames / Paths**: Database connection strings, internal server paths, and SQL snippets are strictly sanitized.
