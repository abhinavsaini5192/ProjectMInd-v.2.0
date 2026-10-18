# ProjectMind Canonical Metric Registry Specification

This catalog defines the canonical metrics grounded in real ProjectMind telemetry and domain records for Phase 9.9.

---

## 1. Metric Schema Definition

Every registered metric conforms to the following schema:
- **`metricId`**: Unique, hierarchical string identifier (`category.entity.measurement`).
- **`name`**: Human-readable display title.
- **`description`**: Detailed definition and measurement semantics.
- **`category`**: One of the 10 canonical analytics categories.
- **`valueType`**: `NUMBER` | `PERCENTAGE` | `DURATION_MS` | `BYTES` | `RATIO`.
- **`unit`**: Unit of measurement (e.g. `requests`, `milliseconds`, `percent`, `tokens`).
- **`definitionVersion`**: Semantic versioning of the metric definition (`1.0.0`).
- **`supportedScopes`**: Array of legal scopes (`INSTANCE`, `WORKSPACE`, `PROJECT`, `REPOSITORY`, `PLUGIN`).
- **`authoritativeSource`**: Subsystem responsible for generating ground truth data.
- **`aggregationMethod`**: `SUM` | `AVG` | `COUNT` | `LATEST` | `P50` | `P90` | `P99` | `MIN` | `MAX` | `RATIO`.
- **`freshnessSeconds`**: Maximum acceptable SLA before evidence is marked `STALE`.
- **`privacyClassification`**: `PUBLIC` | `INTERNAL` | `CONFIDENTIAL` | `RESTRICTED`.

---

## 2. Standard Metric Catalog

### A. Platform Usage (`PLATFORM_USAGE`)
| Metric ID | Unit | Value Type | Method | Source | Privacy | Description |
|---|---|---|---|---|---|---|
| `usage.active_workspaces.count` | workspaces | NUMBER | COUNT | `WorkspaceService` | INTERNAL | Number of unique workspaces active in window |
| `usage.active_projects.count` | projects | NUMBER | COUNT | `ProjectService` | INTERNAL | Number of unique projects active in window |
| `usage.context_requests.count` | requests | NUMBER | SUM | `ContextOrchestrator` | INTERNAL | Total context orchestration requests |
| `usage.feature_queries.count` | queries | NUMBER | SUM | `FeatureKnowledgeAPI` | INTERNAL | Total queries to Feature Knowledge API |
| `usage.plans_created.count` | plans | NUMBER | SUM | `PlannerService` | INTERNAL | Total task execution plans created |
| `usage.tasks_completed.count` | tasks | NUMBER | SUM | `TaskRuntime` | INTERNAL | Total tasks completed successfully |
| `usage.agent_sessions.count` | sessions | NUMBER | SUM | `AgentSessionManager` | INTERNAL | Total agent interaction sessions |
| `usage.plugin_invocations.count` | invocations | NUMBER | SUM | `PluginExecutionManager` | INTERNAL | Total plugin extension operations executed |

### B. Repository Intelligence (`REPOSITORY_INTELLIGENCE`)
| Metric ID | Unit | Value Type | Method | Source | Privacy | Description |
|---|---|---|---|---|---|---|
| `repo.repositories_analyzed.count` | repositories | NUMBER | COUNT | `RepositoryIntelligenceEngine` | INTERNAL | Total repositories with completed extraction |
| `repo.analysis_freshness.seconds` | seconds | DURATION_MS | LATEST | `RepositoryIntelligenceEngine` | INTERNAL | Elapsed seconds since last analysis |
| `repo.extraction_success.count` | extractions | NUMBER | SUM | `ExtractionPipeline` | INTERNAL | Count of successful extraction jobs |
| `repo.extraction_failure.count` | failures | NUMBER | SUM | `ExtractionPipeline` | INTERNAL | Count of failed extraction jobs |
| `repo.indexed_resources.count` | resources | NUMBER | LATEST | `KnowledgeGraph` | INTERNAL | Files, symbols, and modules in graph |
| `repo.feature_count` | features | NUMBER | LATEST | `FeatureKnowledgeAPI` | INTERNAL | Total discovered features mapped |
| `repo.stale_knowledge_references.count` | references | NUMBER | LATEST | `KnowledgeUpdateCoordinator` | INTERNAL | Stale file references in graph |

### C. Context Intelligence (`CONTEXT_INTELLIGENCE`)
| Metric ID | Unit | Value Type | Method | Source | Privacy | Description |
|---|---|---|---|---|---|---|
| `context.requests.count` | requests | NUMBER | SUM | `ContextOrchestrator` | INTERNAL | Total context requests handled |
| `context.package_size.tokens` | tokens | NUMBER | AVG | `ContextOrchestrator` | INTERNAL | Average token size of assembled context |
| `context.assembly_latency.ms` | milliseconds | DURATION_MS | AVG | `ContextOrchestrator` | INTERNAL | Average latency to synthesize context package |
| `context.cache_hit_rate.percentage` | percent | PERCENTAGE | AVG | `ContextOrchestrator` | INTERNAL | Percentage of requests served from cache |
| `context.failure_rate.percentage` | percent | PERCENTAGE | AVG | `ContextOrchestrator` | INTERNAL | Percentage of context requests failing |
| `context.explicit_feedback.count` | submissions | NUMBER | SUM | `FeedbackService` | INTERNAL | Explicit ratings on context usefulness |

### D. Retrieval & Project Memory (`RETRIEVAL_AND_MEMORY`)
| Metric ID | Unit | Value Type | Method | Source | Privacy | Description |
|---|---|---|---|---|---|---|
| `retrieval.requests.count` | queries | NUMBER | SUM | `RetrievalEngine` | INTERNAL | Total search queries executed |
| `retrieval.latency.ms` | milliseconds | DURATION_MS | AVG | `RetrievalEngine` | INTERNAL | Average query latency in milliseconds |
| `retrieval.memory_frequency.count` | recalls | NUMBER | SUM | `ProjectMemoryService` | INTERNAL | Count of project memory recall operations |
| `retrieval.failure_rate.percentage` | percent | PERCENTAGE | AVG | `RetrievalEngine` | INTERNAL | Retrieval failure percentage |
| `retrieval.index_freshness.seconds` | seconds | DURATION_MS | LATEST | `SemanticIndexJobHandler` | INTERNAL | Seconds elapsed since last index update |

### E. Agent & Collaboration Intelligence (`AGENT_COLLABORATION`)
| Metric ID | Unit | Value Type | Method | Source | Privacy | Description |
|---|---|---|---|---|---|---|
| `agent.sessions.count` | sessions | NUMBER | SUM | `CollaborationManager` | INTERNAL | Active/completed collaboration sessions |
| `agent.tasks_assigned.count` | tasks | NUMBER | SUM | `CollaborationManager` | INTERNAL | Subtasks assigned across agents |
| `agent.handoffs.count` | handoffs | NUMBER | SUM | `CollaborationManager` | INTERNAL | Inter-agent task handoffs |
| `agent.task_completion_rate.percentage` | percent | PERCENTAGE | AVG | `CollaborationManager` | INTERNAL | Tasks successfully completed by agents |
| `agent.disconnects.count` | disconnects | NUMBER | SUM | `AgentSessionManager` | INTERNAL | Unexpected session disconnects |
| `agent.conflicts.count` | conflicts | NUMBER | SUM | `CollaborationManager` | INTERNAL | Concurrent resource editing conflicts |

### F. Planning & Execution (`PLANNING_AND_EXECUTION`)
| Metric ID | Unit | Value Type | Method | Source | Privacy | Description |
|---|---|---|---|---|---|---|
| `planning.plans_created.count` | plans | NUMBER | SUM | `PlannerService` | INTERNAL | Plans formulated by planner |
| `planning.plan_validation_failures.count` | failures | NUMBER | SUM | `PlannerService` | INTERNAL | Candidate plans rejected by validation |
| `planning.blocked_task_duration.ms` | milliseconds | DURATION_MS | SUM | `TaskRuntime` | INTERNAL | Cumulative time spent in BLOCKED state |
| `planning.plan_revisions.count` | revisions | NUMBER | SUM | `PlannerService` | INTERNAL | Plan revisions during execution |
| `planning.replanning_frequency.count` | replans | NUMBER | SUM | `PlannerService` | INTERNAL | Replanning triggers from task failures |
| `planning.task_completion_latency.ms` | milliseconds | DURATION_MS | AVG | `TaskRuntime` | INTERNAL | Milliseconds elapsed from READY to COMPLETED |
| `planning.verification_pass_rate.percentage` | percent | PERCENTAGE | AVG | `VerificationProcessor` | INTERNAL | Verification checks passing across tasks |

### G. Learning Intelligence (`LEARNING_INTELLIGENCE`)
| Metric ID | Unit | Value Type | Method | Source | Privacy | Description |
|---|---|---|---|---|---|---|
| `learning.feedback_volume.count` | items | NUMBER | SUM | `LearningIntelligenceService` | INTERNAL | Feedback records received |
| `learning.candidates_generated.count` | candidates | NUMBER | SUM | `LearningIntelligenceService` | INTERNAL | Distilled learning candidates created |
| `learning.candidate_acceptance_rate.percentage` | percent | PERCENTAGE | AVG | `LearningIntelligenceService` | INTERNAL | Evaluated candidates approved |
| `learning.deployed_changes.count` | deployments | NUMBER | SUM | `LearningIntelligenceService` | INTERNAL | Active learning updates in heuristics |
| `learning.rollbacks.count` | rollbacks | NUMBER | SUM | `LearningIntelligenceService` | INTERNAL | Deployed learning updates rolled back |

### H. Plugin Intelligence (`PLUGIN_INTELLIGENCE`)
| Metric ID | Unit | Value Type | Method | Source | Privacy | Description |
|---|---|---|---|---|---|---|
| `plugin.registered.count` | plugins | NUMBER | LATEST | `PluginRegistry` | INTERNAL | Total registered plugins |
| `plugin.enabled.count` | plugins | NUMBER | LATEST | `PluginService` | INTERNAL | Installed & enabled plugins |
| `plugin.invocations.count` | invocations | NUMBER | SUM | `PluginExecutionManager` | INTERNAL | Total plugin operations invoked |
| `plugin.failure_rate.percentage` | percent | PERCENTAGE | AVG | `PluginExecutionManager` | INTERNAL | Percentage of plugin invocations failing |
| `plugin.compatibility_failures.count` | failures | NUMBER | SUM | `PluginCompatibilityChecker` | INTERNAL | Incompatible plugin installs rejected |
| `plugin.timeouts.count` | timeouts | NUMBER | SUM | `PluginExecutionManager` | INTERNAL | Plugin executions cancelled by timeout |
| `plugin.permission_denials.count` | denials | NUMBER | SUM | `PluginSecurityPolicyEngine` | CONFIDENTIAL | Capability requests rejected by security |

### I. Reliability & Operations (`RELIABILITY_AND_OPERATIONS`)
| Metric ID | Unit | Value Type | Method | Source | Privacy | Description |
|---|---|---|---|---|---|---|
| `reliability.api_requests.count` | requests | NUMBER | SUM | `MetricsRegistry` | INTERNAL | Total HTTP/IPC requests handled |
| `reliability.error_rate.percentage` | percent | PERCENTAGE | AVG | `MetricsRegistry` | INTERNAL | Percentage of API calls resulting in errors |
| `reliability.api_latency.p95_ms` | milliseconds | DURATION_MS | P95 | `MetricsRegistry` | INTERNAL | 95th percentile request latency |
| `reliability.job_failures.count` | failures | NUMBER | SUM | `JobQueue` | INTERNAL | Background job failures |

### J. Security & Governance (`SECURITY_AND_GOVERNANCE`)
| Metric ID | Unit | Value Type | Method | Source | Privacy | Description |
|---|---|---|---|---|---|---|
| `security.authorization_denials.count` | denials | NUMBER | SUM | `AuthorizationService` | CONFIDENTIAL | Unauthorized requests blocked |
| `security.policy_violations.count` | violations | NUMBER | SUM | `SecurityIncidentManager` | CONFIDENTIAL | Data classification/governance violations |
| `security.permission_changes.count` | changes | NUMBER | SUM | `AuditLogger` | CONFIDENTIAL | Role assignments/permission alterations |
| `security.audit_coverage.percentage` | percent | PERCENTAGE | AVG | `PersistentAuditStore` | CONFIDENTIAL | Percentage of sensitive actions audited |
| `security.suspicious_plugin_activity.count` | events | NUMBER | SUM | `PluginSecurityPolicyEngine` | CONFIDENTIAL | Unauthorized plugin filesystem/net calls |
| `security.cross_scope_attempts.count` | attempts | NUMBER | SUM | `ScopeValidator` | CONFIDENTIAL | Blocked cross-scope access attempts |

---

## 3. Deprecation and Versioning Policy
- Metric definitions follow semantic versioning (`major.minor.patch`).
- Minor updates (`1.0.0` -> `1.1.0`) preserve calculation semantics and unit definitions.
- Breaking modifications to calculation method, numerator/denominator formulas, or unit representations require a major version bump (`2.0.0`) and must not be registered without an explicit deprecation grace period.
