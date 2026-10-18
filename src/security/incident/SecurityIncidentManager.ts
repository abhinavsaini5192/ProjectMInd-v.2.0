import { randomUUID } from 'crypto';
import type {
  SecurityIncident,
  SecurityIncidentCategory,
  SecurityIncidentStatus,
  SecurityContainmentAction,
} from './SecurityIncident.js';
import type { ResourceScope } from '../models/ResourceScope.js';
import type { IAuditLogger } from '../interfaces/IAuditLogger.js';

export interface RecordIncidentParams {
  readonly category: SecurityIncidentCategory;
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  readonly source: string;
  readonly affectedScope: ResourceScope;
  readonly correlationId?: string | undefined;
  readonly evidenceReference?: string | undefined;
  readonly details?: Record<string, unknown> | undefined;
}

export interface ContainmentHandlers {
  readonly revokeSession?: (sessionId: string) => Promise<boolean> | boolean;
  readonly disableCredential?: (credentialId: string) => Promise<boolean> | boolean;
  readonly stopJob?: (jobId: string) => Promise<boolean> | boolean;
  readonly invalidateCache?: (keyOrPrefix: string) => Promise<boolean> | boolean;
}

export class SecurityIncidentManager {
  private readonly incidents = new Map<string, SecurityIncident>();

  constructor(
    private readonly auditLogger?: IAuditLogger | undefined,
    private readonly containmentHandlers: ContainmentHandlers = {}
  ) {}

  public async recordIncident(params: RecordIncidentParams): Promise<SecurityIncident> {
    const incidentId = `inc-${randomUUID()}`;
    const now = Date.now();

    const incident: SecurityIncident = {
      incidentId,
      category: params.category,
      severity: params.severity,
      status: 'DETECTED',
      detectedAt: now,
      source: params.source,
      affectedScope: params.affectedScope,
      correlationId: params.correlationId,
      evidenceReference: params.evidenceReference,
      containmentStatus: 'UNCONTAINED',
      resolutionStatus: 'OPEN',
      actionsTaken: [],
      details: params.details ?? {},
    };

    this.incidents.set(incidentId, incident);

    if (this.auditLogger) {
      await this.auditLogger.logEvent({
        eventType: 'SECURITY_VIOLATION',
        principalId: 'system',
        action: 'security.incident.detected',
        resourceType: 'SECURITY_POLICY',
        resourceId: incidentId,
        workspaceId: params.affectedScope.workspaceId,
        repositoryId: params.affectedScope.repositoryId,
        sessionId: params.affectedScope.sessionId,
        taskId: params.affectedScope.taskId,
        result: 'FAILURE',
        policyVersion: '1.0.0',
        details: {
          category: params.category,
          severity: params.severity,
          source: params.source,
        },
      });
    }

    return incident;
  }

  public async applyContainment(
    incidentId: string,
    action: {
      type: 'REVOKE_SESSION' | 'DISABLE_CREDENTIAL' | 'STOP_JOB' | 'INVALIDATE_CACHE' | 'QUARANTINE_RESOURCE';
      target: string;
      description: string;
    }
  ): Promise<SecurityIncident> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found`);
    }

    let success = false;
    try {
      switch (action.type) {
        case 'REVOKE_SESSION':
          if (this.containmentHandlers.revokeSession) {
            success = Boolean(await this.containmentHandlers.revokeSession(action.target));
          }
          break;
        case 'DISABLE_CREDENTIAL':
          if (this.containmentHandlers.disableCredential) {
            success = Boolean(await this.containmentHandlers.disableCredential(action.target));
          }
          break;
        case 'STOP_JOB':
          if (this.containmentHandlers.stopJob) {
            success = Boolean(await this.containmentHandlers.stopJob(action.target));
          }
          break;
        case 'INVALIDATE_CACHE':
          if (this.containmentHandlers.invalidateCache) {
            success = Boolean(await this.containmentHandlers.invalidateCache(action.target));
          }
          break;
        case 'QUARANTINE_RESOURCE':
          success = true;
          break;
      }
    } catch {
      success = false;
    }

    const appliedAction: SecurityContainmentAction = {
      actionId: `act-${randomUUID()}`,
      type: action.type,
      appliedAt: Date.now(),
      target: action.target,
      description: action.description,
      status: success ? 'APPLIED' : 'FAILED',
    };

    const updated: SecurityIncident = {
      ...incident,
      containmentStatus: success ? 'CONTAINED' : 'UNCONTAINED',
      status: success ? 'CONTAINED' : incident.status,
      actionsTaken: [...incident.actionsTaken, appliedAction],
    };

    this.incidents.set(incidentId, updated);
    return updated;
  }

  public resolveIncident(
    incidentId: string,
    resolution: { status: 'RESOLVED' | 'CLOSED'; notes?: string }
  ): SecurityIncident {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found`);
    }

    const updated: SecurityIncident = {
      ...incident,
      status: resolution.status,
      resolutionStatus: 'RESOLVED',
      resolvedAt: Date.now(),
      details: {
        ...incident.details,
        resolutionNotes: resolution.notes,
      },
    };

    this.incidents.set(incidentId, updated);
    return updated;
  }

  public getIncident(incidentId: string): SecurityIncident | undefined {
    return this.incidents.get(incidentId);
  }

  public listIncidents(): SecurityIncident[] {
    return Array.from(this.incidents.values()).sort((a, b) => b.detectedAt - a.detectedAt);
  }
}
