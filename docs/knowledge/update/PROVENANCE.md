# Provenance & Trust Hierarchy

## Provenance Levels

Knowledge updates track source provenance explicitly to preserve trustworthiness and resist hallucination or poisoning:

| Provenance Level | Description | Default Trust Weight |
| :--- | :--- | :--- |
| `SYSTEM_VERIFIED` | Produced by automated testing, CI pipelines, or cryptographically verified builds. | 1.00 |
| `MANUALLY_CONFIRMED` | Explicitly confirmed by a human developer or administrator. | 0.95 |
| `SYSTEM_OBSERVED` | Emitted by ProjectMind's kernel, file watchers, or instrumentation hooks. | 0.90 |
| `DERIVED` | Formed through deterministic graph traversals and formal dependency calculations. | 0.85 |
| `AGENT_REPORTED` | Asserted by an external LLM agent via tool protocols or claims. | 0.70 |
| `INFERRED` | Heuristic association based on path patterns or naming conventions. | 0.60 |
| `IMPORTED` | Ingested from external third-party metadata feeds. | 0.50 |
| `CONFLICTING` | Contradictory evidence detected; under precedence resolution. | 0.30 |
| `UNKNOWN` | Unspecified provenance. | 0.20 |

## Anti-Forging Protection

External coding agents interacting via the Tool Protocol or API cannot elevate their own trust:

> [!CAUTION]
> If an update originates from source `AGENT` or `MANUAL` and specifies `SYSTEM_VERIFIED` provenance, `KnowledgeUpdateValidator` rejects it immediately with an `InvalidKnowledgeUpdateError`.

Claims made by agents remain `AGENT_REPORTED` until independent verification evidence (e.g. from CI or a test runner) arrives with `SYSTEM_VERIFIED` provenance.
