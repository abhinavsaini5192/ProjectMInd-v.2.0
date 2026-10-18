# ProjectMind API Request & Response Contracts

## 1. Universal Response Envelope

All API endpoints return data wrapped inside the canonical [`ApiResponse<T>`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/contracts/ApiResponse.ts) envelope:

```typescript
export interface ApiResponse<T = unknown> {
  readonly status: number;
  readonly headers?: Record<string, string> | undefined;
  readonly data: T;
  readonly meta: ApiMetadata;
}
```

### Response Wire Format (JSON)
```json
{
  "status": 200,
  "data": {
    "featureId": "feat-402",
    "name": "Semantic Code Graph Parser",
    "status": "ACTIVE"
  },
  "meta": {
    "requestId": "req_01928374",
    "correlationId": "corr_99887766",
    "apiVersion": "v1",
    "timestamp": 1758963600000,
    "durationMs": 14,
    "rateLimit": {
      "limit": 100,
      "remaining": 98,
      "reset": 46
    }
  }
}
```

### Standard Metadata Fields (`ApiMetadata`)

| Field | Type | Description |
|---|---|---|
| `requestId` | `string` | Unique tracking ID generated or propagated for this HTTP call. |
| `correlationId` | `string` | Distributed trace correlation identifier spanning multiple hops. |
| `apiVersion` | `string` | Resolved API version used to execute the request (e.g. `"v1"`). |
| `timestamp` | `number` | Server epoch timestamp in milliseconds when response was formed. |
| `durationMs` | `number` (optional) | Execution latency in milliseconds inside the platform. |
| `pagination` | `object` (optional) | Pagination statistics for collection endpoints. |
| `rateLimit` | `object` (optional) | Real-time rate limit quota status for the principal. |
| `warnings` | `array` (optional) | Non-fatal informational warnings or deprecation notices. |

---

## 2. Pagination Contract

ProjectMind supports both **Offset-Based** and **Cursor-Based** pagination patterns for all list endpoints.

### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | `integer` | `1` | 1-indexed page number (Offset pagination). |
| `pageSize` / `limit` | `integer` | `20` | Items per page (min: 1, max: 100). |
| `cursor` | `string` | `undefined` | Opaque base64 cursor pointing to the next/previous page (Cursor pagination). |

### Pagination Response Metadata
```json
{
  "meta": {
    "pagination": {
      "page": 2,
      "pageSize": 20,
      "totalCount": 85,
      "totalPages": 5,
      "hasMore": true,
      "nextCursor": "eyJsYXN0SWQiOiJmZWF0LTA0MCJ9",
      "prevCursor": "eyJsYXN0SWQiOiJmZWF0LTAyMCJ9"
    }
  }
}
```

---

## 3. Filtering & Sorting Contract

### Filtering Syntax
Clients filter collections using query parameters formatted as `filter[<field>]=<value>` or `filter[<field>][<operator>]=<value>`:
- `GET /v1/features?filter[status]=ACTIVE` (Exact match / `eq`)
- `GET /v1/features?filter[confidenceScore][gte]=0.85` (Comparison / `gte`)
- `GET /v1/features?filter[tags][in]=core,auth` (Set inclusion / `in`)
- `GET /v1/features?filter[name][like]=auth*` (Wildcard match / `like`)

### Sorting Syntax
Clients sort collections using query parameters:
- `sort=<field>:<direction>` (e.g., `sort=updatedAt:desc,name:asc`)
- Or explicit parameters: `sortBy=updatedAt&sortOrder=desc`

---

## 4. Idempotency Contract

All mutative HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) support safe retry semantics via the `Idempotency-Key` header.

### Usage Protocol
1. **Client sends mutative request** with a unique key:
   ```http
   POST /v1/context/sessions HTTP/1.1
   Host: api.projectmind.ai
   Idempotency-Key: a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d
   Content-Type: application/json

   { "title": "Index Repository" }
   ```
2. **Server Operation**:
   - Computes SHA-256 fingerprint of the request path + payload.
   - Atomically reserves the key with status `IN_PROGRESS`.
   - Executes controller and canonical domain service.
   - On completion, caches the response status, headers, and body with status `COMPLETED` (TTL: 24 hours).
3. **Replay Response**:
   If the client retries with the same `Idempotency-Key` and identical payload, the cached response is immediately returned with the header:
   ```http
   idempotent-replayed: true
   ```
4. **Conflict Protections**:
   - **Payload Mismatch**: Reusing an existing key with a different body throws `409 CONFLICT`.
   - **Concurrent In-Flight Request**: A parallel request with the same key while the first is `IN_PROGRESS` throws `409 IDEMPOTENCY_CONFLICT`.
   - **Cross-Principal Protection**: A principal cannot access or replay an idempotency key created by a different principal (`403 FORBIDDEN`).

---

## 5. Canonical Endpoint Catalog

### System & Health Endpoints
- `GET /v1/health`: Overall system health status and backing service checks.
- `GET /v1/health/liveness`: Kubernetes liveness probe (returns `200` if process alive).
- `GET /v1/health/readiness`: Kubernetes readiness probe (returns `200` if all services initialized).
- `GET /v1/capabilities`: Advertised platform capabilities, engine limits, and supported models.

### Workspaces & Repositories
- `GET /v1/workspaces`: List caller's workspaces.
- `GET /v1/workspaces/:id`: Retrieve workspace details.
- `POST /v1/workspaces`: Create a new workspace.
- `GET /v1/repositories`: List repositories within current workspace.
- `POST /v1/repositories`: Register a new repository.
- `GET /v1/repositories/:id/status`: Check indexing and health status of repository.

### Context Engine (Phase 5/7)
- `POST /v1/context/sessions`: Create a context orchestration session.
- `GET /v1/context/sessions/:id`: Get context session state and history.
- `POST /v1/context/bundles`: Generate an optimized context bundle for an agent task.
- `POST /v1/context/optimizations`: Optimize context tokens under budget constraints.

### Feature Knowledge (Phase 4/7)
- `GET /v1/features`: Search and list features with pagination and filtering.
- `GET /v1/features/:id`: Get detailed feature specification.
- `POST /v1/features`: Create a new feature entry.
- `PUT /v1/features/:id`: Update feature metadata or status.
- `DELETE /v1/features/:id`: Delete or archive a feature.
- `GET /v1/features/:id/graph`: Retrieve dependency graph for a feature.
- `GET /v1/features/:id/drift`: Detect architectural or code drift for a feature.

### Knowledge Updates (Phase 4/7)
- `POST /v1/knowledge/updates`: Ingest git diff or incremental file modifications.
- `GET /v1/knowledge/updates/:id`: Inspect knowledge update processing status.
- `POST /v1/knowledge/updates/ingest`: Batch ingest multi-file updates.

### Agent Runtime (Phase 6/7)
- `POST /v1/agent/sessions`: Initialize an autonomous agent session.
- `GET /v1/agent/sessions/:id`: Get agent session status and task graph.
- `POST /v1/agent/tasks`: Create an agent task.
- `POST /v1/agent/tasks/:id/execute`: Trigger autonomous execution cycle for a task.
- `GET /v1/agent/tasks/:id/status`: Poll real-time progress and logs of an executing task.

### Verification (Phase 6/7)
- `POST /v1/verification/runs`: Start automated verification run against repository code.
- `GET /v1/verification/runs/:id`: Get verification outcomes, assertions, and test results.
- `POST /v1/verification/assert`: Evaluate individual validation predicates.
