# ProjectMind API Request Lifecycle & Runtime Coordination

## 1. Request Lifecycle Overview

Every API call processed by ProjectMind undergoes a 7-stage deterministic lifecycle managed by the [`ApiService`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/services/ApiService.ts), the [`ApiRouter`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/routing/ApiRouter.ts), and the composable middleware pipeline.

```
+─────────────────────────────────────────────────────────────────────────────+
|                        STAGE 1: Ingestion & Normalization                   |
|  - Raw Node stream parsed (body, headers, query string)                     |
|  - RequestService generates ApiRequest and ApiRequestContext                |
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
|                     STAGE 2: Correlation & Telemetry Setup                  |
|  - Resolves or generates x-request-id and x-correlation-id                  |
|  - TelemetryMiddleware initializes high-resolution execution timer          |
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
|                     STAGE 3: Security & Rate Verification                   |
|  - VersionResolver validates API version compatibility                      |
|  - RateLimiter validates client request quota                               |
|  - IAuthenticator authenticates identity -> SecurityPrincipal               |
|  - IAuthorizer enforces RBAC/ABAC default-deny policy                       |
|  - ScopeValidationMiddleware verifies workspace/repository tenant boundary  |
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
|                     STAGE 4: Idempotency Check & Lock                       |
|  - If mutative request has Idempotency-Key:                                 |
|    - Computes SHA-256 payload hash                                          |
|    - Checks store: if COMPLETED -> replay response immediately              |
|    - If IN_PROGRESS -> return 409 IDEMPOTENCY_CONFLICT                      |
|    - Otherwise -> acquire atomic IN_PROGRESS lock                           |
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
|                     STAGE 5: Route Matching & Execution                     |
|  - ApiRouter matches path template (/v1/features/:id) and HTTP method       |
|  - Dispatches to Domain Controller (FeatureController, ContextController)   |
|  - Controller unpacks DTO and invokes Canonical Domain Service Engine       |
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
|                     STAGE 6: Response Assembly & Commit                     |
|  - Domain result wrapped in ApiResponse<T> envelope                         |
|  - ResponseService computes durationMs, appends pagination & rate limit meta|
|  - Idempotency completed: cached in store for 24h replay                    |
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
|                     STAGE 7: Egress Serialization & Metrics                 |
|  - HttpAdapter serializes JSON payload and sets HTTP status / headers       |
|  - Telemetry logs execution span (latency, status, principalId, route)      |
+─────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Request Context Propagation

Throughout the lifecycle, an immutable [`ApiRequestContext`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/contracts/ApiRequestContext.ts) object travels through all middlewares and controller handlers:

```typescript
export interface ApiRequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly apiVersion: string;
  readonly timestamp: number;
  readonly clientIp?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly principal?: SecurityPrincipal | undefined;
  readonly securityContext?: SecurityContext | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly metadata: Record<string, unknown>;
}
```

This ensures downstream canonical engines always have non-repudiable audit trails, tenant boundaries, and caller identity.

---

## 3. Observability & Telemetry Instrumentation

The [`TelemetryMiddleware`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/middleware/TelemetryMiddleware.ts) automatically instruments every request:
1. **Duration Tracking**: Records duration with millisecond accuracy (`durationMs`).
2. **Span Metrics**: Emits structured log events containing:
   - `route`: Pattern template (e.g. `GET /v1/features/:id`) to prevent metric cardinality explosion.
   - `statusCode`: HTTP status code (200, 400, 404, 500).
   - `principalId`: Authenticated actor ID (or `'anonymous'`).
   - `correlationId`: Distributed trace context.
3. **Audit Trail**: Mutating operations record changes to the audit subsystem.

---

## 4. Graceful Shutdown & Connection Draining

In cloud-native container environments (Kubernetes, AWS ECS), the API layer integrates with the [`PlatformShutdownCoordinator`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/platform/lifecycle/PlatformShutdownCoordinator.ts):

### Shutdown Sequence
1. **Signal Interception**: Upon receiving `SIGTERM` or `SIGINT`, the shutdown coordinator initiates phase 1 shutdown.
2. **Readiness Probe Transition**: `/v1/health/readiness` immediately transitions to return `503 SERVICE_UNAVAILABLE`, instructing ingress load balancers to cease routing new traffic to this pod.
3. **In-Flight Connection Draining**:
   - The HTTP server stops accepting new TCP connections.
   - Existing in-flight requests are allowed up to 15 seconds (`shutdownTimeoutMs`) to complete.
   - The idempotency service preserves in-progress locks, and any pending agent task executions are safely checkpointed.
4. **Service Teardown**: Database connections, query caches, and background workers are flushed and closed in reverse dependency order.
5. **Process Exit**: The process exits with code 0.
