import { describe, it, expect, vi } from 'vitest';
import { SecurityIncidentManager } from '../../src/security/incident/SecurityIncidentManager.js';

describe('Security Incident - Detection, Containment & Governance', () => {
  it('records security incidents across canonical categories with audit integration', async () => {
    const mockAuditLogger = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as any;

    const manager = new SecurityIncidentManager(mockAuditLogger);

    const incident = await manager.recordIncident({
      category: 'UNAUTHORIZED_ACCESS',
      severity: 'HIGH',
      source: 'api_gateway',
      affectedScope: { workspaceId: 'ws-secret', repositoryId: 'repo-core' },
      correlationId: 'corr-inc-1',
      details: { ipAddress: '192.168.1.100', attemptedAction: 'context:read' },
    });

    expect(incident.incidentId).toMatch(/^inc-/);
    expect(incident.status).toBe('DETECTED');
    expect(incident.containmentStatus).toBe('UNCONTAINED');
    expect(incident.resolutionStatus).toBe('OPEN');
    expect(mockAuditLogger.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SECURITY_VIOLATION',
        principalId: 'system',
        action: 'security.incident.detected',
        workspaceId: 'ws-secret',
        repositoryId: 'repo-core',
      })
    );
  });

  it('applies safe automated containment actions and tracks containment status', async () => {
    const revokeSessionHandler = vi.fn().mockResolvedValue(true);
    const disableCredentialHandler = vi.fn().mockResolvedValue(true);

    const manager = new SecurityIncidentManager(undefined, {
      revokeSession: revokeSessionHandler,
      disableCredential: disableCredentialHandler,
    });

    const incident = await manager.recordIncident({
      category: 'CREDENTIAL_COMPROMISE',
      severity: 'CRITICAL',
      source: 'git_scanner',
      affectedScope: { global: true },
    });

    // Apply REVOKE_SESSION
    const afterSession = await manager.applyContainment(incident.incidentId, {
      type: 'REVOKE_SESSION',
      target: 'sess-hacked-99',
      description: 'Terminated active compromised session',
    });

    expect(afterSession.containmentStatus).toBe('CONTAINED');
    expect(afterSession.actionsTaken).toHaveLength(1);
    expect(afterSession.actionsTaken[0]?.status).toBe('APPLIED');
    expect(revokeSessionHandler).toHaveBeenCalledWith('sess-hacked-99');

    // Apply DISABLE_CREDENTIAL
    const afterCred = await manager.applyContainment(incident.incidentId, {
      type: 'DISABLE_CREDENTIAL',
      target: 'cred-leaked-key',
      description: 'Revoked leaked API token',
    });

    expect(afterCred.actionsTaken).toHaveLength(2);
    expect(disableCredentialHandler).toHaveBeenCalledWith('cred-leaked-key');
  });

  it('manages incident resolution lifecycle', async () => {
    const manager = new SecurityIncidentManager();
    const incident = await manager.recordIncident({
      category: 'PROMPT_INJECTION',
      severity: 'MEDIUM',
      source: 'agent_input_filter',
      affectedScope: { workspaceId: 'ws-sandbox' },
    });

    const resolved = manager.resolveIncident(incident.incidentId, {
      status: 'RESOLVED',
      notes: 'Prompt injection attempts neutralized by PromptInjectionGuard',
    });

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolutionStatus).toBe('RESOLVED');
    expect(resolved.resolvedAt).toBeDefined();
    expect(resolved.details.resolutionNotes).toContain('neutralized');

    // Check retrieval
    const retrieved = manager.getIncident(incident.incidentId);
    expect(retrieved?.status).toBe('RESOLVED');
  });
});
