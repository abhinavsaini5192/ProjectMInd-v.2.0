# ProjectMind Verification Evidence Security (Phase 8.9)

## 1. Provenance of Verification Claims

Verification evidence (test outputs, linter passes, security scans) directly affects feature confidence scores and completion readiness.
Adversarial agents might attempt to forge verification reports:
```json
{
  "testSuite": "unit_tests",
  "status": "PASSED",
  "source": "CI",
  "trustLevel": "SYSTEM_VERIFIED"
}
```

## 2. Provenance Taxonomy & Strict Gates

ProjectMind enforces 6 explicit provenance sources:
1. `AGENT_REPORTED`: Self-reported by an external agent. Evaluated as unverified claim.
2. `MANUAL`: Verified by a human software engineer.
3. `SYSTEM_OBSERVED`: Recorded directly by ProjectMind runtime observers.
4. `SYSTEM_VERIFIED`: Confirmed by internal deterministic verification runners.
5. `CI`: Ingested via authenticated continuous integration webhook with signed HMAC tokens.
6. `UNKNOWN`: Unclassified source; fails closed.

`ProvenanceValidator.assertProvenance` rejects any attempt by an agent or user principal to assert `SYSTEM_VERIFIED`, `SYSTEM_OBSERVED`, or `CI`.
