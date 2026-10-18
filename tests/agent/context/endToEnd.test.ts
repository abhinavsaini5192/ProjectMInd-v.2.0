import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';

describe('Phase 7.4 End-to-End Task Context Scenario (Section 43)', () => {
  it('executes full task lifecycle with change reporting, invalidation, and smart refresh', async () => {
    const harness = createContextHarness();

    // ==========================================
    // Step 1: Agent starts task "Fix login request timeout."
    // ==========================================
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'agent-sess-prod-1',
      workspaceId: 'ws-mind-1',
      repositoryId: 'repo-mind-1',
      taskText: 'Fix login request timeout.',
      taskTitle: 'Fix Login Timeout',
      taskIntent: 'DEBUGGING',
    });

    const T1 = startResult.task;
    const CS1 = startResult.contextSession;
    const initialPkg = startResult.contextPackage;

    expect(T1.taskId).toBeDefined();
    expect(T1.status).toBe('READY');
    expect(CS1.contextSessionId).toBeDefined();
    expect(CS1.currentContextVersion).toBe(1);

    // Initial context contains Authentication, AuthController, AuthService, SessionService
    const featureNames = initialPkg.features.map((f) => f.name);
    expect(featureNames).toContain('Authentication');
    expect(featureNames).toContain('Session Management');

    const resourcePaths = initialPkg.resources.map((r) => r.path);
    expect(resourcePaths).toContain('src/auth/AuthService.ts');
    expect(resourcePaths).toContain('src/auth/AuthController.ts');
    expect(resourcePaths).toContain('src/session/SessionService.ts');

    // ==========================================
    // Step 2 & 3: Agent modifies AuthService.login() externally and reports execution
    // ==========================================
    const reportResult = await harness.sessionManager.reportExecution({
      taskId: T1.taskId,
      contextSessionId: CS1.contextSessionId,
      agentSessionId: CS1.agentSessionId,
      status: 'IN_PROGRESS',
      summary: 'Increased HTTP client timeout and added exponential retry in AuthService.login()',
      modifiedFiles: ['src/auth/AuthService.ts'],
    });

    // ==========================================
    // Step 4 & 5: ProjectMind resolves changed resource and impact analysis identifies Authentication & Session Management
    // ==========================================
    expect(reportResult.invalidation.affectedResources).toContain('src/auth/AuthService.ts');
    expect(reportResult.invalidation.affectedFeatures).toContain('feat-auth');
    expect(reportResult.invalidation.affectedFeatures).toContain('feat-session');
    expect(reportResult.invalidation.decision).toBe('PARTIAL_REFRESH_REQUIRED');

    // ==========================================
    // Step 6: Current context is marked PARTIALLY_STALE
    // ==========================================
    expect(reportResult.isStale).toBe(true);

    const stateAfterChange = await harness.sessionManager.getContextState(CS1.contextSessionId);
    expect(stateAfterChange?.freshness).toBe('PARTIALLY_STALE');

    // ==========================================
    // Step 7, 8, 9: Agent requests current context, ProjectMind refreshes affected sections to Version 2 and reuses unaffected context
    // ==========================================
    const currentResult = await harness.sessionManager.getCurrentContext(
      CS1.contextSessionId,
      {
        includeDelta: true,
        baseContextVersion: 1,
        autoRefreshIfStale: true,
      }
    );

    expect(currentResult.wasRefreshed).toBe(true);
    expect(currentResult.contextVersion).toBe(2);
    expect(currentResult.freshness).toBe('CURRENT');

    // Delta verification: AuthService was modified
    expect(currentResult.delta).toBeDefined();
    expect(currentResult.delta?.baseContextVersion).toBe(1);
    expect(currentResult.delta?.targetContextVersion).toBe(2);

    // Unchanged context (architecture) was reused
    expect(currentResult.contextPackage.features).toHaveLength(2);
    expect(currentResult.contextPackage.resources.length).toBeGreaterThanOrEqual(3);

    // Context session updated in store
    const finalSession = await harness.sessionManager.getContextSession(CS1.contextSessionId);
    expect(finalSession?.currentContextVersion).toBe(2);
    expect(finalSession?.status).toBe('ACTIVE');
  });
});
