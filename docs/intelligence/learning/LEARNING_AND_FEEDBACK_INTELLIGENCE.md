# Learning & Feedback Intelligence Architecture (Phase 9.7)

## 1. Executive Summary

Phase 9.7 introduces the canonical **Learning & Feedback Intelligence Layer** for ProjectMind. Its purpose is to enable ProjectMind to learn from validated developer and agent interactions to continuously improve future:
- Context selection & packaging (Phase 9.3)
- Hybrid semantic retrieval & ranking (Phase 9.4)
- Task planning, decomposition & verification recommendations (Phase 9.6)
- Multi-agent collaboration & role assignments (Phase 9.5)
- Project memory retention & obsolescence detection (Phase 9.4)
- Feature discovery & mapping refinements (Phase 3 & 4)

Crucially, this is achieved **without turning ProjectMind into an uncontrolled self-modifying system**. The learning system never alters source code or runtime system logic arbitrarily. Instead, it produces bounded, scoped, versioned, reversible, explainable, and policy-governed adaptations.

---

## 2. Fundamental Philosophy: Feedback is Not Automatically Truth

In complex enterprise software repositories, feedback cannot be taken at face value.
An agent declaring *"File X is useful"* does not mean File X is globally relevant. A user stating *"This context was irrelevant"* does not mean the file is irrelevant for all tasks. A task succeeding does not prove its plan was optimal.

ProjectMind enforces strict ontological boundaries:

```
Interaction / Observation
          ↓
  Untrusted Feedback
          ↓ [Validation, Sanitization, Poisoning Check, Deduplication]
Canonical Feedback Record
          ↓ [Evidence Aggregation, Direction, Magnitude]
    Learning Signal
          ↓ [Proposal, Risk, Reversibility, Scope Resolution]
   Learning Candidate
          ↓ [Multi-Dimensional Quality Evaluation, Shadow Mode]
   Validated Learning
          ↓ [Policy Engine, Scope Gating, Human Approval]
   Deployed Learning (Versioned & Reversible)
          ↓
 Controlled Subsystem Adaptation
```

---

## 3. Feedback Domain Model & Taxonomy

### Canonical Feedback Entity
Located at [`src/intelligence/learning/models/Feedback.ts`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/models/Feedback.ts):
- `id`: Unique identifier (UUID).
- `workspaceId`, `projectId`, `repositoryIds`: Enforces multi-tenant workspace and project boundary isolation.
- `sourceType`: `USER`, `AGENT`, `TASK`, `PLAN`, `CONTEXT`, `RETRIEVAL`, `VERIFICATION`, `EXECUTION`, `COLLABORATION`, `SYSTEM`, `REVIEW`, `UNKNOWN`.
- `sourceId`: Specific ID of the reporting agent, task, or user.
- `feedbackType`: Controlled enum from `FeedbackType`.
- `targetType`: Type of entity receiving feedback (`RESOURCE`, `FILE`, `PLAN`, `AGENT`, `MEMORY`, etc.).
- `targetId`: URI or identifier of the target.
- `signal`: Direction (`POSITIVE`, `NEGATIVE`, `NEUTRAL`, `CONFIRM`, `REJECT`).
- `value`: Normalized numerical strength `[0.0, 1.0]`.
- `confidence`: Confidence of the feedback source `[0.0, 1.0]`.
- `provenance`: Audit metadata tracking reporting agent, role, session, task, execution, verification, and hash.
- `scope`: Controlled scope level (`RESOURCE`, `FILE`, `FEATURE`, `PROJECT`, `WORKSPACE`, `GLOBAL`, etc.).
- `timestamp`: UTC ISO timestamp.
- `evidenceReferences`: Clickable trace links to verification records, task outputs, or diffs.

### Controlled Feedback Taxonomy
Located at [`src/intelligence/learning/models/FeedbackType.ts`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/models/FeedbackType.ts):
- **Context Intelligence**: `CONTEXT_USEFUL`, `CONTEXT_IRRELEVANT`, `CONTEXT_MISSING`, `CONTEXT_TOO_LARGE`, `CONTEXT_TOO_SMALL`.
- **Retrieval & Search**: `RETRIEVAL_RELEVANT`, `RETRIEVAL_IRRELEVANT`, `RETRIEVAL_MISSED`, `RETRIEVAL_DUPLICATE`.
- **Planning & Decomposition**: `PLAN_GOOD`, `PLAN_BAD`, `PLAN_INCOMPLETE`, `PLAN_OVER_DECOMPOSED`, `PLAN_UNDER_DECOMPOSED`.
- **Task Scheduling & Priority**: `TASK_ASSIGNMENT_GOOD`, `TASK_ASSIGNMENT_BAD`, `TASK_PRIORITY_GOOD`, `TASK_PRIORITY_BAD`.
- **Verification**: `VERIFICATION_SUFFICIENT`, `VERIFICATION_INSUFFICIENT`.
- **Collaboration**: `AGENT_HANDOFF_GOOD`, `AGENT_HANDOFF_BAD`.
- **Feature Intelligence**: `FEATURE_MAPPING_CORRECT`, `FEATURE_MAPPING_INCORRECT`.
- **Memory**: `MEMORY_USEFUL`, `MEMORY_IRRELEVANT`.
- **Explanations**: `EXPLANATION_USEFUL`, `EXPLANATION_UNCLEAR`.
- **System Outcomes & Corrections**: `ERROR_CORRECTED`, `USER_CORRECTION`, `SYSTEM_OUTCOME`, `UNKNOWN`.

---

## 4. Normalization & Security Pipeline

Located at [`src/intelligence/learning/services/FeedbackNormalizer.ts`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/services/FeedbackNormalizer.ts):
1. **Input Validation**: Rejects missing fields, malformed types, or invalid UUIDs.
2. **Sanitization & Prompt Injection Defense**: Strips control characters, flags injection attempts (`system:`, `override:`, `ignore instructions`, etc.), and sanitizes commentary to prevent prompt poisoning.
3. **Poisoning & Forgery Protection**:
   - Caps agent-reported confidence at 0.80.
   - Forbids unprivileged agents from forging `USER` or `VERIFIED` authority.
   - Rejects unverified synthetic outcomes claiming 1.0 confidence.
4. **Authority Derivation**: Distinguishes `USER_REPORTED`, `AGENT_REPORTED`, `OBSERVED`, `DERIVED`, `VERIFIED`.
5. **Scope Clamping**: Non-admin users and agents cannot create `GLOBAL` feedback; their scope is automatically clamped to their active `PROJECT` or `RESOURCE`.
6. **Deduplication**: Computes deterministic hash keys across `(workspaceId, projectId, sourceType, feedbackType, targetType, targetId, taskReference)` to prevent feedback flooding.

---

## 5. Learning Signals & Evidence Aggregation

Located at [`src/intelligence/learning/services/LearningSignalExtractor.ts`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/services/LearningSignalExtractor.ts):
- Feedback is aggregated into **Learning Signals** over time.
- Signals evaluate:
  - **Observation Count**: Frequency of occurrences.
  - **Source Diversity**: Observations confirmed across multiple distinct agents or verified task outcomes.
  - **Consistency**: High ratio of positive vs negative feedback.
  - **Recency**: Decaying weight for stale feedback.
  - **Outcome Correlation**: Correlating feedback with actual task verification outcomes.
- **Contradiction Resolution**: If Agent A claims a file is useful while Agent B claims it is irrelevant, the extractor groups by task type / feature context. It avoids naive numerical averaging and instead isolates the scope (e.g., useful for `auth` tasks, irrelevant for `billing` tasks).

---

## 6. Learning Candidates & Multi-Dimensional Evaluation

Located at [`src/intelligence/learning/services/LearningCandidateGenerator.ts`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/services/LearningCandidateGenerator.ts) and [`LearningEvaluator.ts`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/services/LearningEvaluator.ts):

Each candidate defines:
- `target`: System entity affected.
- `proposedChange`: Structured parameters (e.g., boosting relevance score by +0.15, adding a verification step).
- `expectedEffect` & `risk`: Risk categorized as `LOW`, `MEDIUM`, or `HIGH`.
- `reversibility`: Whether changes can be cleanly rolled back (`FULL`, `PARTIAL`, `IRREVERSIBLE`). All standard learning changes are `FULL`.
- `status`: Lifecycle status (`PROPOSED`, `SHADOW`, `ACCEPTED`, `REJECTED`, `DEPLOYED`, `ROLLED_BACK`, `SUPERSEDED`, `EXPIRED`).

### Quality Dimensions
1. `evidenceQuality`
2. `sourceDiversity`
3. `consistency`
4. `recency`
5. `scopePrecision`
6. `reversibility`
7. `riskScore`
8. `confidence`
9. `conflictLevel`

### Offline Shadow Evaluation
Candidates can enter `SHADOW` mode. In shadow mode, the system runs candidate heuristics alongside active heuristics without altering production responses, comparing shadow score outcomes against actual subsequent task successes.

---

## 7. Policy Engine & Loop Protection

Located at [`src/intelligence/learning/services/LearningPolicyEngine.ts`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/services/LearningPolicyEngine.ts):
- **Scope Gating**:
  - `GLOBAL` scope requires explicit human approval (`requiresHumanApproval: true`), confidence $\ge 0.90$, evidence count $\ge 15$, and source diversity $\ge 5$.
  - `PROJECT` scope requires confidence $\ge 0.70$ and evidence count $\ge 3$.
  - `RESOURCE` scope can be auto-approved when risk is `LOW`.
- **Runaway Loop Protection**: Clamps maximum adaptation magnitude per cycle to $[0.05, 0.25]$. Prevents exponential weight compounding and runaway self-reinforcement.
- **Stale Learning Detection**: Automatically flags learning artifacts older than policy TTL (e.g. 90 days) without recent reinforcement as `STALE`.

---

## 8. Deployment, Versioning & Reversible Rollback

Located at [`src/intelligence/learning/services/LearningDeploymentManager.ts`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/services/LearningDeploymentManager.ts) and [`LearningRollbackManager.ts`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/services/LearningRollbackManager.ts):
- Every deployed learning is assigned an incremental version number (`version: 1, 2, ...`).
- When a new candidate replaces an existing deployed learning for the same target and scope, the previous version is marked `SUPERSEDED` and linked via `supersededBy`.
- **Rollback Operation**:
  - Reverts status to `ROLLED_BACK`.
  - Automatically reactivates the previous superseded version if one exists.
  - Emits an auditable event `learning.rolled_back` with full user provenance and rationale.

---

## 9. Subsystem Integrations

Located in [`src/intelligence/learning/integrations/`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/integrations/):
1. **Context Engine (`ContextLearningAdapter`)**:
   - Injects learned resource boosts into context candidate scoring.
   - Forcibly includes high-confidence omitted files (`CONTEXT_RESOURCE_BOOST`).
   - Penalizes irrelevant resources (`CONTEXT_RESOURCE_PENALTY`).
2. **Hybrid Semantic Retrieval (`RetrievalLearningAdapter`)**:
   - Adjusts ranking scores for search results based on learned relevance for query types.
3. **Task Planning (`PlanningLearningAdapter`)**:
   - Recommends missing verification tasks for planning nodes based on historical failures.
   - Suggests decomposition adjustments.
4. **Multi-Agent Collaboration (`CollaborationLearningAdapter`)**:
   - Augments agent suitability scores based on validated execution success rates.
5. **Project Memory (`MemoryLearningAdapter`)**:
   - Identifies high-utility memories for promotion and stale memories for pruning.
6. **Feature Intelligence (`FeatureLearningAdapter`)**:
   - Recommends feature naming and association confidence improvements while strictly preserving deterministic AST repository facts.

---

## 10. Background Processing & Jobs

Located in [`src/intelligence/learning/jobs/`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/intelligence/learning/jobs/):
Integrated directly with the Phase 8 Job System (`JobType`):
- `LEARNING_AGGREGATION`: Aggregates pending feedback into learning signals and candidates.
- `LEARNING_EVALUATION`: Runs offline shadow evaluation and quality scoring on candidates.
- `LEARNING_MAINTENANCE`: Detects stale learning artifacts and triggers expiration.

All job handlers are idempotent, support retries, and respect workspace/project boundaries.

---

## 11. API & CLI Reference

### REST API
- `POST /api/v1/learning/feedback`: Submit feedback.
- `GET /api/v1/learning/feedback`: Query feedback items.
- `POST /api/v1/learning/signals/generate`: Trigger signal extraction.
- `POST /api/v1/learning/candidates/generate`: Trigger candidate generation.
- `POST /api/v1/learning/candidates/:id/evaluate`: Evaluate candidate.
- `POST /api/v1/learning/candidates/:id/deploy`: Deploy learning candidate.
- `POST /api/v1/learning/candidates/:id/rollback`: Roll back deployed learning.
- `GET /api/v1/learning/explain/:id`: Structured explainability report.

### CLI Commands
- `projectmind feedback submit --type CONTEXT_MISSING --target src/auth.ts --signal POSITIVE`
- `projectmind feedback inspect --target src/auth.ts`
- `projectmind learning candidates --project proj-123`
- `projectmind learning deploy <candidateId> --approvedBy user1`
- `projectmind learning rollback <learningId> --reason "Regression observed"`
- `projectmind learning explain <id>`
