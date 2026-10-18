import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryProjectMemoryStore } from '../../src/memory/project/services/InMemoryProjectMemoryStore.js';
import { ProjectMemoryManager } from '../../src/memory/project/services/ProjectMemoryManager.js';

describe('ProjectMemoryLifecycle Tests (Phase 9.4 Section 44)', () => {
  let store: InMemoryProjectMemoryStore;
  let manager: ProjectMemoryManager;

  beforeEach(() => {
    store = new InMemoryProjectMemoryStore();
    manager = new ProjectMemoryManager(store);
  });

  it('1. Propose and list memory candidate', async () => {
    const candidate = await manager.proposeCandidate({
      workspaceId: 'ws_alpha',
      projectId: 'proj_backend',
      repositoryId: 'repo_api',
      type: 'ARCHITECTURE',
      title: 'Hexagonal Architecture for Payment Domain',
      content: 'Payment domain will use ports and adapters pattern to isolate third-party gateways.',
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'DEVELOPER',
      confidence: 0.9,
      authority: 'AUTHORITATIVE',
      evidence: ['ADR-012'],
      relatedResources: ['src/payments/'],
      relatedFeatures: ['feat_payments'],
      relatedTasks: ['task_arch_review'],
    });

    expect(candidate.candidateId).toBeDefined();
    expect(candidate.proposedAt).toBeGreaterThan(0);

    const candidates = await store.listCandidates('repo_api', 'proj_backend');
    expect(candidates.length).toBe(1);
    expect(candidates[0]!.title).toBe('Hexagonal Architecture for Payment Domain');
  });

  it('2. Candidate rejection removes candidate cleanly', async () => {
    const candidate = await manager.proposeCandidate({
      workspaceId: 'ws_alpha',
      projectId: 'proj_backend',
      repositoryId: 'repo_api',
      type: 'DECISION',
      title: 'Temporary In-Memory Storage',
      content: 'Store user sessions in process memory permanently.',
      source: 'CODE_OBSERVATION',
      provenance: 'AGENT',
      confidence: 0.4,
      authority: 'NON_AUTHORITATIVE',
      evidence: [],
      relatedResources: [],
      relatedFeatures: [],
      relatedTasks: [],
    });

    const rejected = await manager.rejectCandidate(candidate.candidateId, 'Violates scalability requirements');
    expect(rejected).toBe(true);

    const candidates = await store.listCandidates('repo_api', 'proj_backend');
    expect(candidates.length).toBe(0);
  });

  it('3. Promotion enforces provenance rules: AGENT cannot auto-promote to AUTHORITATIVE', async () => {
    // AGENT proposed memory claiming to be AUTHORITATIVE
    const agentCandidate = await manager.proposeCandidate({
      workspaceId: 'ws_alpha',
      projectId: 'proj_backend',
      repositoryId: 'repo_api',
      type: 'TECHNICAL',
      title: 'Database indexing assumption',
      content: 'All queries use index on user_id.',
      source: 'CODE_OBSERVATION',
      provenance: 'AGENT',
      confidence: 0.7,
      authority: 'AUTHORITATIVE', // Agent claims this
      evidence: ['Agent log trace'],
      relatedResources: ['src/db/'],
      relatedFeatures: [],
      relatedTasks: [],
    });

    // Promotion without override
    const memory = await manager.promoteCandidate(agentCandidate.candidateId);
    // Provenance guard must downgrade authority to NON_AUTHORITATIVE
    expect(memory.authority).toBe('NON_AUTHORITATIVE');
    expect(memory.status).toBe('ACTIVE');
  });

  it('4. Promotion from DEVELOPER provenance receives AUTHORITATIVE authority', async () => {
    const devCandidate = await manager.proposeCandidate({
      workspaceId: 'ws_alpha',
      projectId: 'proj_backend',
      repositoryId: 'repo_api',
      type: 'DECISION',
      title: 'Mandatory OAuth2 PKCE',
      content: 'All mobile and SPA clients must use OAuth2 with PKCE.',
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'DEVELOPER',
      confidence: 1.0,
      authority: 'AUTHORITATIVE',
      evidence: ['ADR-099'],
      relatedResources: ['src/auth/oauth.ts'],
      relatedFeatures: ['feat_auth'],
      relatedTasks: [],
    });

    const memory = await manager.promoteCandidate(devCandidate.candidateId);
    expect(memory.authority).toBe('AUTHORITATIVE');
  });

  it('5. Explicit override allows governance/human to promote AGENT memory to AUTHORITATIVE', async () => {
    const agentCandidate = await manager.proposeCandidate({
      workspaceId: 'ws_alpha',
      projectId: 'proj_backend',
      repositoryId: 'repo_api',
      type: 'SECURITY',
      title: 'TLS 1.3 Minimum Protocol',
      content: 'All inbound network traffic must enforce TLS 1.3 cipher suites.',
      source: 'CODE_OBSERVATION',
      provenance: 'AGENT',
      confidence: 0.95,
      authority: 'NON_AUTHORITATIVE',
      evidence: ['nginx.conf check'],
      relatedResources: ['nginx.conf'],
      relatedFeatures: [],
      relatedTasks: [],
    });

    // Explicit override by human reviewer
    const memory = await manager.promoteCandidate(agentCandidate.candidateId, 'AUTHORITATIVE');
    expect(memory.authority).toBe('AUTHORITATIVE');
  });

  it('6. Supersession evolves memory without deleting history', async () => {
    // 1. Initial decision
    const mem1 = await manager.recordMemory({
      workspaceId: 'ws_alpha',
      projectId: 'proj_backend',
      repositoryId: 'repo_api',
      type: 'DECISION',
      title: 'Session Management via Redis',
      content: 'Redis cluster handles user session state and token cache.',
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'DEVELOPER',
      confidence: 0.95,
      authority: 'AUTHORITATIVE',
      status: 'ACTIVE',
      validFrom: 1000,
      evidence: ['ADR-001'],
      relatedResources: ['src/session/SessionStore.ts'],
      relatedFeatures: ['feat_session'],
      relatedTasks: [],
    });

    // 2. Later migration supersedes mem1
    const mem2 = await manager.recordMemory({
      workspaceId: 'ws_alpha',
      projectId: 'proj_backend',
      repositoryId: 'repo_api',
      type: 'DECISION',
      title: 'Session Management via Redis',
      content: 'Session state migrated from Redis to PostgreSQL partitioned tables.',
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'DEVELOPER',
      confidence: 0.95,
      authority: 'AUTHORITATIVE',
      status: 'ACTIVE',
      validFrom: 2000,
      evidence: ['ADR-045'],
      relatedResources: ['src/session/SessionStore.ts'],
      relatedFeatures: ['feat_session'],
      relatedTasks: [],
    });

    await manager.supersedeMemory(mem1.memoryId, mem2.memoryId);

    const oldMem = await store.get(mem1.memoryId);
    const newMem = await store.get(mem2.memoryId);

    expect(oldMem?.status).toBe('SUPERSEDED');
    expect(oldMem?.supersededBy).toBe(mem2.memoryId);
    expect(oldMem?.validUntil).toBeDefined();
    expect(newMem?.status).toBe('ACTIVE');
  });

  it('7. Invalidation sets INVALIDATED status and appends reason', async () => {
    const mem = await manager.recordMemory({
      workspaceId: 'ws_alpha',
      projectId: 'proj_backend',
      repositoryId: 'repo_api',
      type: 'BUG',
      title: 'Flaky retry timeout in worker',
      content: 'Worker retries should use exponential backoff up to 10 seconds.',
      source: 'INCIDENT_POSTMORTEM',
      provenance: 'DEVELOPER',
      confidence: 0.8,
      authority: 'AUTHORITATIVE',
      status: 'ACTIVE',
      evidence: ['INC-102'],
      relatedResources: ['src/worker/'],
      relatedFeatures: [],
      relatedTasks: [],
    });

    await manager.invalidateMemory(mem.memoryId, 'Worker queue was replaced by RabbitMQ streaming consumer');

    const updated = await store.get(mem.memoryId);
    expect(updated?.status).toBe('INVALIDATED');
    expect(updated?.validUntil).toBeDefined();
    expect(updated?.evidence.some((e) => e.includes('Invalidated: Worker queue was replaced'))).toBe(true);
  });

  it('8. Temporal validity query distinguishes before migration vs after migration', async () => {
    // Memory valid from t=1000 to t=2000
    await manager.recordMemory({
      workspaceId: 'ws_alpha',
      projectId: 'proj_backend',
      repositoryId: 'repo_api',
      type: 'DECISION',
      title: 'V1 Storage: MongoDB',
      content: 'Initial document store was MongoDB.',
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'DEVELOPER',
      confidence: 1.0,
      authority: 'AUTHORITATIVE',
      status: 'SUPERSEDED',
      validFrom: 1000,
      validUntil: 2000,
      evidence: [],
      relatedResources: ['src/db/'],
      relatedFeatures: [],
      relatedTasks: [],
    });

    // Memory valid from t=2000 onward
    await manager.recordMemory({
      workspaceId: 'ws_alpha',
      projectId: 'proj_backend',
      repositoryId: 'repo_api',
      type: 'DECISION',
      title: 'V2 Storage: PostgreSQL',
      content: 'Migrated to relational PostgreSQL storage.',
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'DEVELOPER',
      confidence: 1.0,
      authority: 'AUTHORITATIVE',
      status: 'ACTIVE',
      validFrom: 2000,
      evidence: [],
      relatedResources: ['src/db/'],
      relatedFeatures: [],
      relatedTasks: [],
    });

    // Query at timestamp 1500 (before migration)
    const at1500 = await manager.queryMemories({
      repositoryId: 'repo_api',
      validAt: 1500,
    });
    expect(at1500.length).toBe(1);
    expect(at1500[0]!.title).toBe('V1 Storage: MongoDB');

    // Query at timestamp 2500 (after migration)
    const at2500 = await manager.queryMemories({
      repositoryId: 'repo_api',
      validAt: 2500,
    });
    expect(at2500.length).toBe(1);
    expect(at2500[0]!.title).toBe('V2 Storage: PostgreSQL');
  });

  it('9. Project scope isolation strictly isolates foreign projects', async () => {
    await manager.recordMemory({
      workspaceId: 'ws_alpha',
      projectId: 'proj_payments',
      repositoryId: 'repo_api',
      type: 'SECURITY',
      title: 'PCI-DSS Tokenization Secret Strategy',
      content: 'Payment card tokens use HSM-backed encryption keys.',
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'DEVELOPER',
      confidence: 1.0,
      authority: 'AUTHORITATIVE',
      status: 'ACTIVE',
      evidence: ['PCI-COMPLIANCE'],
      relatedResources: ['src/payments/tokens.ts'],
      relatedFeatures: ['feat_pci'],
      relatedTasks: [],
    });

    // Query from authorized project
    const authResults = await manager.queryMemories({
      workspaceId: 'ws_alpha',
      projectId: 'proj_payments',
    });
    expect(authResults.length).toBe(1);

    // Query from unauthorized foreign project
    const foreignResults = await manager.queryMemories({
      workspaceId: 'ws_alpha',
      projectId: 'proj_analytics_unauthorized',
    });
    expect(foreignResults.length).toBe(0);
  });
});
