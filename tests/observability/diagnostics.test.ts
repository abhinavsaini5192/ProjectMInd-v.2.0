import { describe, it, expect, beforeEach } from 'vitest';
import { DiagnosticManager } from '../../src/observability/index.js';

describe('Observability - Diagnostics Subsystem', () => {
  let diagnosticManager: DiagnosticManager;

  beforeEach(() => {
    diagnosticManager = new DiagnosticManager({
      appVersion: '8.5.0',
      apiVersion: 'v1',
      environment: 'production',
      maxDiagnostics: 10,
    });
  });

  it('records and retrieves active diagnostics with sanitized details', () => {
    const diag = diagnosticManager.recordDiagnostic({
      category: 'STORAGE',
      component: 'sqlite_store',
      severity: 'ERROR',
      message: 'Failed to write WAL file with token sk-secret123',
      remediationHint: 'Check write permissions on /data',
      metadata: {
        dbPath: '/var/data/mind.db',
        secret_key: 'top_secret',
      },
    });

    expect(diag.diagnosticId).toBeDefined();
    expect(diag.status).toBe('ACTIVE');
    expect(diag.message).not.toContain('sk-secret123');
    expect(diag.message).toContain('[REDACTED]');
    expect(diag.metadata?.['secret_key']).toBe('[REDACTED]');

    const active = diagnosticManager.getActiveDiagnostics();
    expect(active).toHaveLength(1);
    expect(active[0]!.diagnosticId).toBe(diag.diagnosticId);
  });

  it('resolves active diagnostics', () => {
    const diag = diagnosticManager.recordDiagnostic({
      category: 'API',
      component: 'rate_limiter',
      severity: 'WARNING',
      message: 'Rate limit threshold reached for client',
    });

    expect(diagnosticManager.getActiveDiagnostics()).toHaveLength(1);

    const resolved = diagnosticManager.resolveDiagnostic(diag.diagnosticId);
    expect(resolved).toBe(true);

    expect(diagnosticManager.getActiveDiagnostics()).toHaveLength(0);
  });

  it('generates sanitized operational snapshot without sensitive data', async () => {
    diagnosticManager.recordDiagnostic({
      category: 'SECURITY',
      component: 'auth_service',
      severity: 'CRITICAL',
      message: 'Repeated auth failure from client',
      metadata: {
        authorization: 'Bearer sk-abcdef1234567890abcdef',
        normalTag: 'security_event',
      },
    });

    const snapshot = await diagnosticManager.createSnapshot();
    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.applicationVersion).toBe('8.5.0');
    expect(snapshot.environment).toBe('production');
    expect(snapshot.runtimeState.nodeVersion).toBeDefined();
    expect(snapshot.runtimeState.memoryUsageMb.heapUsed).toBeGreaterThan(0);
    expect(snapshot.diagnosticCounts.critical).toBe(1);
    expect(snapshot.diagnosticCounts.total).toBe(1);

    // Verify secret redaction inside snapshot
    const active = snapshot.activeDiagnostics[0]!;
    expect(active.metadata?.['authorization']).toBe('[REDACTED]');
    expect(active.metadata?.['normalTag']).toBe('security_event');
  });

  it('filters active diagnostics by category', () => {
    diagnosticManager.recordDiagnostic({
      category: 'STORAGE',
      component: 'db',
      severity: 'ERROR',
      message: 'Disk space low',
    });
    diagnosticManager.recordDiagnostic({
      category: 'API',
      component: 'gateway',
      severity: 'WARNING',
      message: 'Slow response',
    });

    const storageOnly = diagnosticManager.getActiveDiagnostics('STORAGE');
    expect(storageOnly).toHaveLength(1);
    expect(storageOnly[0]!.category).toBe('STORAGE');

    const apiOnly = diagnosticManager.getActiveDiagnostics('API');
    expect(apiOnly).toHaveLength(1);
    expect(apiOnly[0]!.category).toBe('API');
  });
});
