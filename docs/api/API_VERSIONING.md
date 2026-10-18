# ProjectMind API Versioning Strategy & Compatibility Policy

## 1. Overview & Versioning Taxonomy

ProjectMind enforces an explicit, deterministic versioning policy designed to provide backward compatibility for IDE integrations, autonomous agent tools, CI/CD pipelines, and enterprise automation scripts.

The platform follows **Semantic Versioning (SemVer 2.0.0)** semantics for the API surface:
- **Major Version (`v1`, `v2`)**: Introduces breaking schema changes, modified request/response envelopes, removed endpoints, or incompatible semantic behavior changes.
- **Minor Version (`v1.1`, `v1.2`)**: Introduces backward-compatible new endpoints, optional query parameters, or additive response fields.
- **Patch Version (`v1.0.1`)**: Backward-compatible internal bug fixes, performance optimizations, and documentation clarifications.

---

## 2. Version Identification & Resolution

ProjectMind employs a hierarchical, multi-tiered version resolution strategy:

```
[Inbound Request]
        │
        ▼
1. URI Path Prefix Check (e.g. /v1/features/feat-123)
   - Matches regex: ^/(v[0-9]+(\.[0-9]+)?)(/.*)?$
   - Highest Precedence. Explicit and cache-friendly.
        │ (If not matched)
        ▼
2. Custom HTTP Header Check: "x-api-version" (e.g. "1.0", "v1")
        │ (If not matched)
        ▼
3. Standard HTTP Header Check: "Accept-Version" (e.g. "v1")
        │ (If not matched)
        ▼
4. Query Parameter Check: "?api-version=v1" or "?v=1"
        │ (If not matched)
        ▼
5. Fallback to System Default Version: "v1"
```

The resolution logic is implemented in [`VersionResolver`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api/versioning/VersionResolver.ts):
```typescript
const version = VersionResolver.resolveVersion(request);
// => returns canonical string e.g. "v1"
```

---

## 3. Version Compatibility Matrix

| API Version | Status | Release Date | Deprecation Notice | Sunset Date | Support Level |
|---|---|---|---|---|---|
| `v1` | **CURRENT** | Phase 8.3 | None | TBD | Full Production Support |
| `v0` / `beta` | **SUNSET** | Phase 1–7 (Internal) | Deprecated | Immediate | Incompatible / Retired |

---

## 4. Breaking vs. Non-Breaking Changes

### Non-Breaking Changes (Permitted in Minor/Patch releases without version bump)
1. Adding new REST endpoints (e.g., `POST /v1/context/optimizations`).
2. Adding optional fields to request bodies or optional query parameters.
3. Adding new fields to response data payloads (clients MUST ignore unrecognized properties).
4. Adding new error codes or non-fatal warnings to `meta.warnings`.
5. Modifying internal algorithm implementations that preserve contract behavior.

### Breaking Changes (Requires a new Major API version, e.g. `v2`)
1. Removing, renaming, or changing the type of any existing field in request or response envelopes.
2. Modifying the URL path of an existing endpoint.
3. Adding mandatory required fields to existing request contracts.
4. Changing the HTTP status code returned for standard success or error scenarios.
5. Altering the semantic meaning or units of an existing property (e.g., changing timestamp from milliseconds to ISO 8601 string).

---

## 5. Deprecation & Sunset Process

ProjectMind guarantees a transparent deprecation lifecycle to enable zero-downtime client migrations:

### Deprecation Workflow
1. **Deprecation Declaration**: An endpoint or version is marked `DEPRECATED` in the router metadata.
2. **Warning Header Emission**:
   - `Deprecation: @<unix-timestamp>`: Indicates the timestamp when the resource was deprecated.
   - `Sunset: <http-date>`: Indicates the future date and time when the endpoint will be permanently terminated.
   - `Link: <docs-url>; rel="sunset"`: Link to migration documentation.
3. **Response Metadata Injection**:
   Every response in a deprecated version includes a structured warning in `meta.warnings`:
   ```json
   {
     "meta": {
       "warnings": [
         "API version v1 is deprecated as of 2027-01-01 and will sunset on 2027-06-01. Please migrate to v2."
       ]
     }
   }
   ```
4. **Sunset Enforcement**: When the sunset date arrives, requests receive a `410 GONE` or `400 BAD_REQUEST` with error code `UNSUPPORTED_VERSION`.

---

## 6. Version Negotiation Failures

If an inbound request requests an unsupported or malformed version, the system halts execution before dispatching to any controller:

```json
{
  "type": "https://projectmind.ai/errors/unsupported-version",
  "title": "Unsupported API Version",
  "status": 400,
  "code": "UNSUPPORTED_VERSION",
  "detail": "Requested API version 'v99' is not supported. Supported versions: v1.",
  "instance": "/v99/features",
  "requestId": "req_8f1b2c3d",
  "timestamp": 1758963400000
}
```
