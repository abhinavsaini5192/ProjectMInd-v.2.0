# Verification Architecture — ProjectMind Phase 7.7

ProjectMind is an AI-native repository intelligence and context optimization platform. In Phase 7.7, ProjectMind introduces the **Verification Integration layer**, designed to represent, normalize, correlate, and reason about verification evidence originating from external AI agents, trusted CI/CD pipelines, build systems, test runners, linters, typecheckers, and static analyzers.

---

## 1. Core Architectural Principle

ProjectMind maintains a strict separation of concerns across five distinct concepts:

| Concept | Definition | Example |
|---|---|---|
| **REPORT** | An external entity makes a claim about an execution outcome. | *"Agent says integration tests passed."* |
| **OBSERVATION** | ProjectMind records that a report or event was observed. | *"Received TEST_COMPLETED observation."* |
| **VERIFICATION EVIDENCE** | Structured outcome bound to a specific repository state & scope. | *"Integration tests PASSED for commit `a1b2c3`."* |
| **TRUSTED VERIFICATION** | Independent, authoritative confirmation by a verified system. | *"CI run #402 independently confirmed PASSED."* |
| **COMPLETION** | Task satisfies configured verification & completion policies. | *"Task ready to complete: tests + build verified."* |

> [!IMPORTANT]
> **Zero Autonomous Execution**:
> ProjectMind is repository intelligence; it does **NOT** run tests, execute builds, invoke linters or typecheckers, or execute shell commands. All verification evidence is consumed as structured data from external agents, IDEs, or trusted CI integrations.

---

## 2. Verification Subsystem Architecture

```mermaid
graph TD
    subgraph "External Sources"
        EA[External AI Agent / Tool Protocol]
        CI[Trusted CI / Build Pipeline]
        TR[Test Runner / Linter / Typechecker]
        MAN[Manual Reviewer]
    end

    subgraph "Phase 7.7 Verification Integration Layer"
        VTR[VerificationSourceTrustRegistry<br/>Assigns Trust & Provenance]
        VSV[VerificationSecurityValidator<br/>Bounds, Redaction, Anti-Forging]
        VN[VerificationNormalizer<br/>Standardizes Records & Statuses]
        VV[VerificationValidator<br/>Tenant & Schema Validation]
        VC[VerificationCorrelator<br/>Task, Session & Resource Correlation]
        VCR[VerificationConflictResolver<br/>Conflict Detection & Precedence]
        VFE[VerificationFreshnessEvaluator<br/>Smart Resource & Feature Freshness]
        VP[VerificationProcessor<br/>Pipeline Orchestration]
        IVS[(InMemoryVerificationStore)]
        VQS[VerificationQueryService]
    end

    subgraph "Touchpoints & Consumers"
        TP[Canonical Tool Protocol: 36 Tools]
        TCV[TaskCompletionValidator Phase 7.5]
        OP[ObservationProcessor Phase 7.6]
        CO[Context Orchestrator Phase 7.4 / 6]
        FH[Feature Health & History Events Phase 6]
        EB[EventBus]
    end

    EA -->|projectmind_report_verification| TP
    CI -->|Trusted Submission| VP
    TR -->|Structured Results| VP
    MAN -->|Manual Confirmation| VP
    TP --> VP

    VP --> VTR
    VTR --> VSV
    VSV --> VN
    VN --> VV
    VV --> VC
    VC --> VCR
    VCR --> VFE
    VFE --> IVS

    VP -->|Completion Evidence| TCV
    VP -->|Observation Reference| OP
    VP -->|Context Invalidation| CO
    VP -->|Lifecycle Events| EB
    EB --> FH
    IVS --> VQS
    VQS --> TP
```

---

## 3. Verification Processing Lifecycle

Every incoming verification report passes through an 8-stage bounded pipeline:

```mermaid
sequenceDiagram
    participant Ext as External Source (Agent/CI)
    participant Proc as VerificationProcessor
    participant Trust as VerificationSourceTrustRegistry
    participant Norm as VerificationNormalizer
    participant Val as VerificationValidator
    participant Corr as VerificationCorrelator
    participant Conf as VerificationConflictResolver
    participant Fresh as VerificationFreshnessEvaluator
    participant Store as IVerificationStore
    participant Bus as IEventBus

    Ext->>Proc: processVerification(rawInput)
    Proc->>Trust: resolveProvenance(source, reportedBy)
    Trust-->>Proc: VerificationProvenance
    Proc->>Norm: normalize(rawInput, provenance)
    Norm-->>Proc: VerificationRecord
    Proc->>Val: validate(record, scopeContext)
    Val-->>Proc: isValid
    Proc->>Corr: correlate(record, existingRecords)
    Corr-->>Proc: correlatedRecord
    Proc->>Conf: detectConflicts(correlatedRecord, existing)
    Conf-->>Proc: conflicts[]
    Proc->>Fresh: evaluateFreshness(correlatedRecord)
    Fresh-->>Proc: VerificationFreshness
    Proc->>Store: saveVerification(correlatedRecord)
    Proc->>Store: recordTimelineEntry(taskId, entry)
    Proc->>Bus: publish(verification.completed / failed)
    Proc-->>Ext: VerificationProcessingResult
```

---

## 4. Key Subsystem Components

| Component | Interface | Description |
|---|---|---|
| **VerificationProcessor** | `IVerificationProcessor` | Primary pipeline orchestrator ensuring idempotency, security validation, normalization, and persistence. |
| **VerificationSourceTrustRegistry** | `IVerificationSourceTrustRegistry` | Maps external sources to trust tiers and prevents client-forged trust escalation. |
| **VerificationNormalizer** | `IVerificationNormalizer` | Standardizes raw input into canonical `VerificationRecord` without converting missing data into false certainty. |
| **VerificationValidator** | `IVerificationValidator` | Enforces tenant boundaries (`workspaceId`, `repositoryId`), schema conformity, and payload bounds. |
| **VerificationCorrelator** | `IVerificationCorrelator` | Correlates verification with tasks, sessions, resources, and feature nodes using a 7-tier priority ladder. |
| **VerificationConflictResolver** | `IVerificationConflictResolver` | Detects opposing outcomes between sources and applies strict source precedence rules. |
| **VerificationFreshnessEvaluator** | `IVerificationFreshnessEvaluator` | Smart freshness evaluation comparing repository changes against verified resources and features. |
| **VerificationQueryService** | `IVerificationQueryService` | Exposes bounded, paginated query methods for verifications, summaries, timelines, and completion evidence. |
| **InMemoryVerificationStore** | `IVerificationStore` | Thread-safe in-memory store indexed by `verificationId`, `taskId`, `operationId`, and tenant scope. |
