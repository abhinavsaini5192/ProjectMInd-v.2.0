# Security Observability & Privacy Protection (Phase 8.5)

ProjectMind ensures that telemetry provides comprehensive diagnostic visibility into security events while maintaining strict confidentiality boundaries and respecting Phase 8.2 audit requirements.

---

## 1. Security Telemetry Boundaries

Observability instruments security failures and anomalies **without replacing the security audit log**:

| Aspect | Security Audit System (Phase 8.2) | Observability Telemetry (Phase 8.5) |
|---|---|---|
| **Purpose** | Non-repudiable legal compliance and security forensics | Operational performance, error rates, and failure anomaly detection |
| **Storage** | Dedicated immutable `PersistentAuditEventRepository` | Ephemeral ring buffers, metrics registry, and trace spans |
| **Drop Policy** | Must never drop audit records | Telemetry drops oldest items when buffers fill to prevent process crashes |
| **Data Preserved** | Principal identity, action, exact target scope, status | Anonymized reference, latency, status code, error code |

---

## 2. Redaction & Privacy Invariants

The following information is **strictly forbidden** from appearing in logs, metric labels, span attributes, or diagnostic snapshots:

1. **Passwords and Secret Keys:** Any password, API key, RSA private key, or client secret.
2. **Authorization Headers & Cookies:** `Authorization: Bearer ...`, `Cookie: ...`, `Set-Cookie: ...`.
3. **Repository Source Code:** Full file contents or code files must never be dumped into logs or span attributes.
4. **Raw User Prompts:** Full prompt texts from users or external LLMs must not be logged or used as metric labels.
5. **High-Cardinality Paths:** Local filesystem paths (`/home/user/workspace/repo/...`) are prohibited from metric labels.

---

## 3. Detecting Repeated Access Failures

The `SecurityTelemetry` adapter monitors authentication and authorization failures:

- Increments `security_auth_failures_total` and `security_authz_denials_total`.
- Evaluates failure velocity: if authentication failures exceed `suspiciousThreshold` (default: 5 consecutive failures), it automatically raises an alert:
  - Severity: `WARNING`
  - Category: `SECURITY`
  - Condition: `SUSPICIOUS_AUTH_FAILURES`
  - Message: `High number of authentication failures detected`
