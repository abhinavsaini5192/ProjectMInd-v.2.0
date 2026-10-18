import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger } from '../../src/security/core/AuditLogger.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { SECURITY_EVENTS } from '../../src/security/events/SecurityEvents.js';

describe('Phase 8.2 Security — Audit Logging & Telemetry', () => {
  let auditLogger: AuditLogger;
  let eventBus: NodeEventBus;

  beforeEach(() => {
    eventBus = new NodeEventBus();
    auditLogger = new AuditLogger();
  });

  it('records audit events with immutable eventId, timestamp, and details', async () => {
    const recorded = await auditLogger.logEvent({
      principalId: 'user_operator',
      eventType: 'ROLE_ASSIGNED',
      workspaceId: 'ws_prod',
      resourceType: 'SECURITY_POLICY',
      resourceId: 'MEMBER',
      action: 'ASSIGN',
      result: 'SUCCESS',
      details: { role: 'MEMBER', target: 'agent_1' },
    });

    expect(recorded.eventId).toBeDefined();
    expect(recorded.eventId.startsWith('audit_')).toBe(true);
    expect(recorded.timestamp).toBeDefined();
    expect(recorded.result).toBe('SUCCESS');
    expect(recorded.details?.role).toBe('MEMBER');
  });

  it('automatically redacts sensitive credentials from audit event details', async () => {
    const recorded = await auditLogger.logEvent({
      principalId: 'user_operator',
      eventType: 'AUTHENTICATION_FAILURE',
      result: 'FAILURE',
      details: {
        password: 'PlainTextPassword123!',
        apiKey: 'pm_live_secret_token_abcdef',
        secretKey: 'top_secret',
        safeProperty: 'public_value',
      },
    });

    expect(recorded.details?.password).toBe('[REDACTED]');
    expect(recorded.details?.apiKey).toBe('[REDACTED]');
    expect(recorded.details?.secretKey).toBe('[REDACTED]');
    expect(recorded.details?.safeProperty).toBe('public_value');
  });

  it('queries audit records by principal, workspace, eventType, and limit', async () => {
    await auditLogger.logEvent({
      principalId: 'agent_alpha',
      eventType: 'SENSITIVE_TOOL_EXECUTION',
      workspaceId: 'ws_finance',
      resourceType: 'TOOL',
      action: 'EXECUTE',
      result: 'SUCCESS',
    });

    await auditLogger.logEvent({
      principalId: 'agent_beta',
      eventType: 'SENSITIVE_TOOL_EXECUTION',
      workspaceId: 'ws_hr',
      resourceType: 'TOOL',
      action: 'EXECUTE',
      result: 'SUCCESS',
    });

    await auditLogger.logEvent({
      principalId: 'agent_alpha',
      eventType: 'SECURITY_VIOLATION',
      workspaceId: 'ws_finance',
      resourceType: 'OBSERVATION',
      action: 'REPORT',
      result: 'SUCCESS',
    });

    // Query by principal
    const alphaEvents = await auditLogger.queryEvents({ principalId: 'agent_alpha' });
    expect(alphaEvents.length).toBe(2);

    // Query by workspace
    const hrEvents = await auditLogger.queryEvents({ workspaceId: 'ws_hr' });
    expect(hrEvents.length).toBe(1);

    // Query with limit
    const limited = await auditLogger.queryEvents({ limit: 1 });
    expect(limited.length).toBe(1);
  });

  it('publishes and subscribes to security events on EventBus', () => {
    let violationReceived = false;

    eventBus.subscribe(SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED, (event: any) => {
      expect(event.payload.violationType).toBe('UNAUTHORIZED_ACCESS');
      violationReceived = true;
    });

    eventBus.publish(SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED, {
      violationType: 'UNAUTHORIZED_ACCESS',
      targetScope: { workspaceId: 'ws_restricted' },
      timestamp: new Date().toISOString(),
    });

    expect(violationReceived).toBe(true);
  });
});
