# ProjectMind Degraded Mode & Dependency Isolation

ProjectMind is designed to survive partial system degradation without complete application failure. Dependencies are explicitly categorized according to criticality.

## 1. Dependency Criticality Categories

1. **`CRITICAL`**:
   - Primary persistent database (Postgres/SQLite).
   - Core authorization and security token verification.
   - Behavior on Failure: **Application enters `UNAVAILABLE` state**. All state mutations immediately halt safely to prevent split-brain and corrupt data writes.

2. **`DEGRADABLE`**:
   - Semantic Vector Search (Qdrant).
   - Graph Knowledge Database (Kuzu).
   - Distributed Cache (Redis).
   - Behavior on Failure: **Application enters `DEGRADED` state**. Deterministic lexical/file search is used if vector search is offline; authoritative persistence is queried directly if cache is offline.

3. **`OPTIONAL`**:
   - Telemetry metrics / tracing collector.
   - External notification webhooks.
   - Behavior on Failure: **Application continues execution normally**. Telemetry events are buffered or dropped; core intelligence processing remains intact.

## 2. Supported Degraded Modes Matrix

| Component Down | Criticality | Fallback Behavior | Impact on API Clients |
| :--- | :--- | :--- | :--- |
| **Telemetry Exporter** | `OPTIONAL` | Discard telemetry / local ring buffer | Zero functional impact; internal monitoring reduced |
| **Redis Cache** | `DEGRADABLE` | Bypass cache; read directly from authoritative database | Slightly elevated database read latency; full data consistency |
| **Vector Store** | `DEGRADABLE` | Fallback to AST symbol graph and deterministic code search | Semantic query similarity unavailable; deterministic navigation intact |
| **External AI Provider** | `DEGRADABLE` | Return cached context or deterministic repository bundle | Model-driven generation unavailable; repository bundle generation intact |
| **Primary Storage** | `CRITICAL` | Complete write pause; return HTTP 503 / `UNAVAILABLE` | Mutation requests rejected; uncorrupted state preserved |

## 3. Health Endpoint Representation

The platform `/health` endpoint maps degradation status into 4 discrete health states:
- `HEALTHY`: All critical and degradable dependencies operational.
- `DEGRADED`: One or more optional or degradable dependencies unavailable; system running on fallbacks.
- `RECOVERING`: System actively executing automated or manual recovery operations.
- `UNAVAILABLE`: Critical dependency offline or storage unverified; incoming mutation traffic blocked.
