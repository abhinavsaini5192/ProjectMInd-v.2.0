# Execution Observation Documentation

Phase 7.6 implements the Execution Observation subsystem for ProjectMind, providing structured, verified, non-destructive ingestion of runtime milestones, build and test results, command telemetry, file modifications, and blockers from external agents.

## Index of Documentation

1. [Execution Observation Overview](EXECUTION_OBSERVATION.md)
   - Architectural philosophy: "Observation is Evidence, Not Execution."
   - Division of responsibilities between ProjectMind and external agents.
   - High-level pipeline sequence diagram.

2. [Observation Data Model](OBSERVATION_MODEL.md)
   - `ExecutionObservation` model definition.
   - Observation categories and typing hierarchy.
   - Specialized payloads (`CommandObservationPayload`, `BuildObservationPayload`, `TestObservationPayload`, `BlockerObservationPayload`, `AgentDecisionObservationPayload`, `ResourceObservationPayload`).

3. [Observation Pipeline Architecture](OBSERVATION_PIPELINE.md)
   - Multi-stage pipeline: deduplication, validation, normalization, classification, causal correlation, and persistence.
   - EventBus notification and Feature Knowledge integration (`resources_changed`).

4. [Provenance & Trust Model](OBSERVATION_PROVENANCE.md)
   - Separation of trust levels: `AGENT_REPORTED` vs `SYSTEM_OBSERVED` vs `SYSTEM_VERIFIED`.
   - Source precedence hierarchy.

5. [Conflicts & Precedence Resolution](OBSERVATION_CONFLICTS.md)
   - Contradiction detection algorithms.
   - Precedence ranking: trusted system verifications strictly take precedence over self-reported agent claims.

6. [Security & Hardening](OBSERVATION_SECURITY.md)
   - Strict 64 KB payload size limits.
   - Path traversal prevention.
   - "No Hidden Reasoning" enforcement (Section 41).
   - Multi-format automated secret redaction (NPM, GitHub, Slack, Anthropic, AWS, JWT, Private Keys).

7. [Retention & Knowledge Policy](OBSERVATION_RETENTION.md)
   - Retention categories: `EPHEMERAL`, `TASK_SCOPED`, `SESSION_SCOPED`, `PERMANENT`.
   - Knowledge promotion engine and eviction rules.

8. [Observation Query & Tool Protocol API](OBSERVATION_QUERY_API.md)
   - 4 canonical observation tools: `projectmind_get_execution_observations`, `projectmind_get_task_timeline`, `projectmind_get_execution_summary`, `projectmind_get_observation_conflicts`.
   - Tool schemas, arguments, and return types.
