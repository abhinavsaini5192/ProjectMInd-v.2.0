# ProjectMind Production API Architecture

## 1. Architectural Philosophy & Purpose

ProjectMind is an AI-native repository intelligence and context optimization platform. Phase 8.3 establishes the **Production API & Service Interface Boundary** through which external clients, IDE extensions, developer toolings, CLI integrations, and future platform interfaces communicate with ProjectMind.

### Core Architecture Axioms
1. **Interface Boundary Only**: The API layer contains *zero* business domain logic, zero storage engines, zero duplicate authentication schemes, and zero duplicate state stores. It serves exclusively as a canonical translation, boundary validation, and lifecycle coordination layer.
2. **Canonical Service Delegation**: Every operation received by an API controller is mapped to typed request objects and delegated directly to existing canonical domain engines established in Phases 1–8.2:
   - [ContextOrchestrator](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/orchestration/ContextOrchestrator.ts) (Phase 5/7)
   - [FeatureKnowledgeService](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/knowledge/features/services/FeatureKnowledgeService.ts) (Phase 4/7)
   - [KnowledgeUpdateService](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/knowledge/update/services/KnowledgeUpdateService.ts) (Phase 4/7)
   - [AgentRuntimeEngine](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/agent/runtime/AgentRuntimeEngine.ts) (Phase 6/7)
   - [IVerificationProcessor](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/verification/interfaces/IVerificationProcessor.ts) (Phase 6/7)
   - [PlatformHealthService](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/platform/health/PlatformHealthService.ts) (Phase 8.1)
   - [IAuthenticator](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/interfaces/IAuthenticator.ts) / [IAuthorizer](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/interfaces/IAuthorizer.ts) / [ISecurityContextManager](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/security/interfaces/ISecurityContextManager.ts) (Phase 8.2)
3. **Provider Neutrality**: The API core does not depend on cloud-specific SDKs (AWS, GCP, Azure), specific node web frameworks (Express, Fastify, Koa), or proprietary protocols. The architecture is cleanly divided into transport-agnostic contracts/middleware/routers and pluggable transport adapters (such as `HttpAdapter`).
4. **Strict Isolation of MCP**: Model Context Protocol (MCP) server endpoints exist as peer interfaces connecting into the internal domain services; they are not entangled with HTTP REST pipelines, ensuring neither interface constrains the other.

---

## 2. Ingress Pipeline & Request Lifecycle

Every inbound request flows through a deterministic, reversible, ordered pipeline:

```
+-----------------------------------------------------------------------------------+
|                              Inbound Transport Layer                              |
|                   (e.g., Node HTTP / HTTPS / Local IPC Stream)                    |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                                   HttpAdapter                                     |
|             Maps Node http.IncomingMessage -> Canonical ApiRequest                |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                                 RequestService                                    |
|      Extracts context, correlation IDs, tokens, versioning, parameters            |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                             Global Middleware Pipeline                            |
|                                                                                   |
|  1. CorrelationMiddleware     - Ensures x-request-id & x-correlation-id           |
|  2. TelemetryMiddleware       - Records latency, request counts, route traces     |
|  3. ErrorHandlingMiddleware   - Catches exceptions -> RFC 7807 problem details    |
|  4. VersionResolverMiddleware - Resolves and enforces API version compatibility   |
|  5. RateLimitMiddleware       - Enforces per-client token bucket limits           |
|  6. AuthenticationMiddleware  - Validates API key/JWT -> SecurityPrincipal        |
|  7. AuthorizationMiddleware   - Enforces RBAC/ABAC default-deny policy            |
|  8. ScopeValidationMiddleware - Verifies tenant workspace/repository isolation   |
|  9. IdempotencyMiddleware     - Enforces mutative replay cache via SHA-256 hash   |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                                    ApiRouter                                      |
|            Matches Method + Path Template (e.g., /v1/features/:id)                |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                                 Domain Controller                                 |
|            Validates DTOs, executes domain query or command orchestration         |
|  (ContextController, FeatureController, AgentRuntimeController, etc.)            |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                            Canonical Domain Engines                               |
|       ContextOrchestrator | FeatureKnowledgeService | AgentRuntimeEngine ...      |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                                 ResponseService                                   |
|          Wraps data into canonical ApiResponse<T> with standard ApiMetadata       |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                              Outbound Transport Layer                             |
|          Emits JSON payload, standard HTTP headers, and status code               |
+-----------------------------------------------------------------------------------+
```

---

## 3. Subsystem Breakdown

### 3.1 Contracts (`src/api/contracts/`)
Defines the standard data structures for all communication:
- `ApiRequest`: Transport-agnostic request containing `path`, `method`, `headers`, `query`, `params`, `body`, and `context`.
- `ApiResponse<T>`: Strict response envelope containing `status`, `headers`, `data`, and `meta`.
- `ApiRequestContext`: Immutable per-request metadata containing `requestId`, `correlationId`, `apiVersion`, `principal`, `workspaceId`, `repositoryId`, `securityContext`, and `timestamp`.
- `ApiMetadata`: Standard response metadata including correlation, timing, pagination markers, and rate limit counters.
- `ApiPagination`: Standard offset/limit and cursor-based pagination query parameters and response cursors.
- `ApiFilter` & `ApiSorting`: Type-safe querying operators (`eq`, `neq`, `gt`, `in`, `like`, etc.) and direction controls.

### 3.2 Error Handling (`src/api/errors/`)
- `ApiError`: Extends standard `Error` with HTTP status code, `ApiErrorCode`, detail message, field-level `errors`, and `retryAfter` directives.
- `ApiErrorMapper`: Converts arbitrary errors (internal exceptions, security rejections, validation failures) into RFC 7807 Problem Details payloads with full secret redaction.

### 3.3 Middleware (`src/api/middleware/`)
- Composable onion architecture (`(req, next) => Promise<ApiResponse>`).
- Built-in middlewares: Correlation, Telemetry, ErrorHandling, Authentication, Authorization, ScopeValidation, Idempotency, RateLimit, Validation.

### 3.4 Routing (`src/api/routing/`)
- `ApiRouter`: Path-template matching engine with dynamic parameters (`:id`), wildcard segments, and method dispatching.
- Supports per-route middleware stacks, prefix routing (`/v1`), and route introspection for OpenAPI documentation.

### 3.5 Controllers (`src/api/controllers/`)
- `BaseApiController`: Common controller base providing standard response wrapping, error mapping, pagination, and sorting helpers.
- `HealthController`: Exposes `/v1/health`, `/v1/health/liveness`, `/v1/health/readiness`.
- `CapabilitiesController`: Exposes `/v1/capabilities` advertising platform features and limits.
- `WorkspaceController`: Manages workspace isolation and metadata queries.
- `RepositoryController`: Exposes repository registration, status, and health.
- `ContextController`: Bridges `/v1/context/sessions`, `/v1/context/bundles`, and `/v1/context/optimizations`.
- `FeatureController`: Bridges feature knowledge indexing, search, dependency graphs, and drift detection.
- `KnowledgeUpdateController`: Ingests and processes incremental repository changes and diffs.
- `AgentRuntimeController`: Manages autonomous agent sessions, tasks, checkpoints, and execution loops.
- `VerificationController`: Manages verification runs, test assertions, and diagnostic validation.

### 3.6 Cross-Cutting Capabilities
- `src/api/idempotency/`: Provides `IIdempotencyStore` and `IdempotencyService` with atomic `IN_PROGRESS` locks, SHA-256 payload integrity hashing, and exact cached replay.
- `src/api/ratelimit/`: Token bucket and sliding-window rate limiters with client IP and principal-level isolation.
- `src/api/versioning/`: Semantic versioning resolver with `DEPRECATED` and `SUNSET` header emission.
- `src/api/adapters/`: `HttpAdapter` translating Node HTTP requests to `ApiRequest` and returning canonical `ApiResponse`.

---

## 4. Dependency Injection Integration

All API components are registered with the ProjectMind `DIContainer` through `ApiDISetup.registerApiModule()` using typed injection tokens in `ApiTokens`:
- `ApiTokens.Router`: Central `ApiRouter`
- `ApiTokens.RequestService`: Global request parser and normalizer
- `ApiTokens.ResponseService`: Response formatting and metadata attachment
- `ApiTokens.IdempotencyStore`: Distributed/in-memory idempotency storage
- `ApiTokens.IdempotencyService`: Idempotency lifecycle manager
- `ApiTokens.RateLimiter`: Rate limiter implementation
- `ApiTokens.ApiService`: High-level entry point orchestrating all controllers
- `ApiTokens.HttpAdapter`: Transport bridge for HTTP servers

This allows any external transport (e.g. CLI runner, headless background worker, or embedded test harness) to resolve `ApiService` directly from the container without spawning network listeners.
