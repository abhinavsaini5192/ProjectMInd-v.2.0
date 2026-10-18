# Plugin, SDK & Integration Ecosystem Architecture (Phase 9.8)

## 1. Executive Summary

Phase 9.8 delivers the canonical **Plugin, SDK & Integration Ecosystem** for ProjectMind. It enables external developers and integration engineers to extend ProjectMind safely without directly modifying its internal codebase or destabilizing core intelligence services.

The system is designed around six foundational pillars:
1. **Canonical Manifest & Domain Contracts**: Strict, versioned JSON schemas (validated via Zod) defining plugin identity, dependencies, integrity checksums, and declared extension points.
2. **Capability-Based Security**: Deny-by-default capability and permission model preventing unauthorized access, privilege escalation, and cross-tenant leakage.
3. **Multi-Tenant Scope Isolation**: Strict isolation by `workspaceId` and optional `projectId`. Plugins cannot access or mutate resources outside their authorized boundary.
4. **Isolated Execution Boundary**: Timeout enforcement, cancellation support (`AbortSignal`), graceful failure isolation, and output sanitization protecting the core system against crashes and prompt injection attacks.
5. **Provider-Neutral Integration Adapters**: Bridges for `CONTEXT_PROVIDER`, `RETRIEVAL_PROVIDER`, `TOOL_PROVIDER`, `VERIFICATION_PROVIDER`, and `Learning Intelligence` (Phase 9.7).
6. **Developer-Facing SDK**: High-level, type-safe client library with bounded retries, exponential backoff, jitter, timeout, and cancellation controls.

---

## 2. Architecture & Pipeline

```
External Developer / Third-Party Integration
                    │
                    ▼
          [ ProjectMind SDK ]
                    │
                    ▼ (Manifest & Integrity Validation)
       [ PluginManifestValidator ]
                    │
                    ▼ (Version & Capabilities Check)
     [ PluginCompatibilityChecker ]
                    │
                    ▼
          [ PluginRegistry ] ◄───► [ IPluginStore ]
                    │
                    ▼
       [ PluginLifecycleManager ] (State Machine Enforcement)
                    │
                    ▼ (Least-Privilege Capability Checks)
     [ PluginSecurityPolicyEngine ]
                    │
                    ▼ (Timeouts, Cancellation, Sanitization)
       [ PluginExecutionManager ]
                    │
                    ▼
         [ Integration Adapters ]
  ┌─────────────────┬──────────────────┬─────────────────┐
  │                 │                  │                 │
  ▼                 ▼                  ▼                 ▼
Context Engine    Retrieval Service   MCP / Tools     Verification
(Phase 9.3)       (Phase 9.4)         (Phase 7.3)     (Phase 6)
```

---

## 3. Supported Plugin Types & Extension Points

| Plugin Type | Canonical Interface | Purpose & Integration Point |
| :--- | :--- | :--- |
| `CONTEXT_PROVIDER` | `PluginContextProviderAdapter` | Extends Context Orchestrator (Phase 9.3) by supplying external contextual resources and files. |
| `RETRIEVAL_PROVIDER` | `PluginRetrievalProviderAdapter` | Supplies auxiliary search hits and external indices to Hybrid Search (Phase 9.4). |
| `TOOL_PROVIDER` | `PluginToolProviderAdapter` | Registers custom tools into `AgentToolRegistry` and exposes them via MCP Server (`IMcpToolAdapter`). |
| `VERIFICATION_PROVIDER`| `PluginVerificationProviderAdapter`| Contributes custom linting, testing, and static analysis verification results (Phase 6). |
| `AGENT_ADAPTER` | `AgentAdapter` | Bridges external LLM or agent frameworks into the ProjectMind Agent Runtime. |
| `OBSERVABILITY_EXPORTER`| `IObservabilityExporter` | Pipes platform metrics, traces, and execution logs to external observability backends. |
| `WORKSPACE_INTEGRATION` | Workspace hooks | Responds to workspace creation, repository indexing, and snapshot events. |
| `CLI_EXTENSION` | `CLICommand` | Augments the ProjectMind CLI with domain-specific subcommands. |
| `GENERIC_INTEGRATION` | `IPlugin` | General-purpose external system webhook and notification handler. |

---

## 4. Plugin Lifecycle State Machine

ProjectMind enforces an explicit, deterministic state machine:

```
[DISCOVERED] ──► [VALIDATING] ──► [REGISTERED] ──► [INSTALLING] ──► [INSTALLED]
                       │                                                │
                       ▼                                                ▼
                 [INCOMPATIBLE]                                   [INITIALIZING]
                                                                        │
                                                                        ▼
                                                   [DISABLED] ◄───► [ENABLED]
                                                       │                │
                                                       ▼                ▼
                                                 [UNINSTALLING] ──► [UNINSTALLED]
                                                       ▲
                                                       │
                                                   [FAILED]
```

### State Definitions
- `DISCOVERED`: Manifest located but not yet validated.
- `VALIDATING`: Validating manifest schema, semver formatting, and integrity checksum.
- `REGISTERED`: Manifest validated and stored in global registry.
- `INSTALLING`: Binding plugin to target workspace and project scope.
- `INSTALLED`: Bound to workspace; awaiting configuration and approval.
- `INITIALIZING`: Invoking plugin `initialize(context)` method with scoped logger and event bridge.
- `ENABLED`: Approved, active, and accessible for agent invocation.
- `DISABLED`: Temporarily deactivated; invocations are rejected.
- `FAILED`: Initialization or critical runtime execution faulted; isolated.
- `UNINSTALLING`: Clean shutdown of in-process instances.
- `UNINSTALLED`: Removed from workspace; permission grants revoked.
- `INCOMPATIBLE`: Plugin version or required capabilities conflict with host system.

---

## 5. Capability-Based Security Model

ProjectMind strictly separates **declared capabilities** from **approved permission grants**:

### Controlled Capabilities (`PluginCapability`)
- `READ_PROJECT_CONTEXT`: Read assembled context bundles.
- `READ_FEATURES`: Query architectural features and dependency graphs.
- `READ_ARCHITECTURE`: Read architectural blueprints and boundaries.
- `READ_HISTORY`: Inspect git and evolution histories.
- `READ_PROJECT_MEMORY`: Read project memories and heuristics.
- `REQUEST_CONTEXT`: Trigger context retrieval.
- `SUBMIT_FEEDBACK`: Submit observations to Learning Intelligence.
- `PROPOSE_KNOWLEDGE_UPDATE`: Submit knowledge update proposals (cannot directly mutate).
- `PROVIDE_TOOL`: Expose executable tools to agents and MCP.
- `PROVIDE_CONTEXT`: Supply candidate context items.
- `PROVIDE_RETRIEVAL`: Supply search results.
- `REPORT_VERIFICATION`: Report verification check results.
- `ACCESS_PLUGIN_CONFIGURATION`: Read plugin configuration secrets.

### Security Guarantees
1. **Deny by Default**: Plugins possess zero effective capabilities until an authorized user or administrator approves a `PluginPermissionGrant`.
2. **Scope Clamping**: Non-admin entities cannot grant cross-workspace or global scopes.
3. **No Dynamic Arbitrary Code Execution**: Plugins run through typed interfaces without access to internal kernel services.
4. **Secret Redaction**: All configuration dumps and execution logs recursively scrub API keys (`sk-*`, `ghp_*`) and password fields.
5. **No Self-Authorization**: LLMs or automated agents cannot approve or elevate their own plugin capabilities.

---

## 6. MCP (Model Context Protocol) Compatibility

Plugins declaring `PROVIDE_TOOL` are seamlessly exposed through ProjectMind's canonical MCP Server (`IProjectMindMcpServer`):
1. `PluginToolProviderAdapter` adapts plugin tool definitions into canonical `AgentTool` models.
2. Tools are registered in `AgentToolRegistry`.
3. The existing `IMcpToolAdapter` discovers them and formats them as standard MCP tool definitions with JSON Draft-7 schemas.
4. When an external agent or client invokes the tool over MCP stdio/SSE transport, the call delegates through `AgentToolPipeline`, enforcing tool permissions, rate limits, timeouts, and output validation.

---

## 7. Learning Intelligence Integration (Phase 9.7)

Plugins with `SUBMIT_FEEDBACK` can contribute feedback records via `PluginLearningAdapter`:
- Feedback is strictly tagged with `sourceType: 'AGENT'` or `'SYSTEM'`, never `USER`.
- Confidence is bounded ($\le 0.60$).
- Provenance links back to the originating `pluginId`.
- Prevents malicious plugins from poisoning feedback or bypassing the multi-dimensional evaluation and shadow mode policies of Phase 9.7.
