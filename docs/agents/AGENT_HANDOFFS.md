# Agent Handoffs & Transition Protocol

In a modular software development lifecycle, tasks frequently transition between agents of differing specialization (e.g., Backend Developer → Frontend Developer → QA Engineer).

---

## 1. Structured Handoff Model

Handoffs in ProjectMind are structured engineering artifacts, not raw conversational transcripts:

```typescript
interface AgentHandoff {
  handoffId: string;
  collaborationSessionId: string;
  sourceAgentId: string;
  targetAgentId: string;
  taskId: string;
  projectId: string;
  summary: string;
  completedWork: readonly string[];
  remainingWork: readonly string[];
  changedResources: readonly string[];
  relevantContext?: Record<string, unknown>;
  verificationStatus: 'UNVERIFIED' | 'AGENT_REPORTED' | 'SYSTEM_VERIFIED';
  blockers?: readonly string[];
  status: 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';
  createdAt: number;
  acceptedAt?: number;
  rejectionReason?: string;
}
```

---

## 2. Handoff Protocol & State Transitions

1. **Proposal (`proposeHandoff`)**:
   - Source agent completes its assigned scope of work.
   - Summarizes deliverables, tests, and changed files.
   - Attaches verification status (`SYSTEM_VERIFIED` requires real automated test evidence).
   - Specifies target agent.

2. **Validation**:
   - `HandoffCoordinator` verifies both source and target agents are active participants.
   - Verifies task ownership currently resides with source agent.
   - Enforces workspace and project scope alignment.

3. **Acceptance (`acceptHandoff`)**:
   - Target agent reviews summary and remaining scope.
   - On acceptance, task ownership is automatically transferred to the target agent.
   - Context is tailored to the target agent via Phase 9.3 `ContextOrchestrator`.
   - Event `collaboration:handoff_accepted` is emitted.

4. **Rejection (`rejectHandoff`)**:
   - If acceptance criteria or verification are unsatisfied, target agent rejects handoff with an auditable reason.
   - Task ownership remains with source agent.
   - Status updated to `REJECTED`.

---

## 3. Scoped Context Assembly for Receiving Agents

When an agent accepts a handoff, it does not receive the raw thought stream or private notes of the predecessor. Instead, `CollaborationContextService` assembles:
- Core task objective and constraints.
- Verified deliverables and API contracts.
- Relevant changed files and symbols.
- Architectural decisions made during the prior step.
- Open blockers or pending test requirements.
