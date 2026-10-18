import type { ResourceScope } from '../models/ResourceScope.js';

export type SecurityIncidentStatus =
  | 'DETECTED'
  | 'TRIAGED'
  | 'CONTAINED'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'UNKNOWN';

export type SecurityIncidentCategory =
  | 'UNAUTHORIZED_ACCESS'
  | 'CREDENTIAL_COMPROMISE'
  | 'DATA_EXPOSURE'
  | 'PRIVILEGE_ESCALATION'
  | 'MALICIOUS_AGENT'
  | 'PROMPT_INJECTION'
  | 'INTEGRITY_VIOLATION'
  | 'PROVENANCE_VIOLATION'
  | 'RECOVERY_ABUSE'
  | 'CONFIGURATION_SECURITY'
  | 'DEPENDENCY_SECURITY'
  | 'UNKNOWN';

export type ContainmentStatus = 'UNCONTAINED' | 'CONTAINING' | 'CONTAINED' | 'NOT_APPLICABLE';
export type ResolutionStatus = 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED';

export interface SecurityContainmentAction {
  readonly actionId: string;
  readonly type: 'REVOKE_SESSION' | 'DISABLE_CREDENTIAL' | 'STOP_JOB' | 'INVALIDATE_CACHE' | 'QUARANTINE_RESOURCE' | 'CUSTOM';
  readonly appliedAt: number;
  readonly target: string;
  readonly description: string;
  readonly status: 'APPLIED' | 'FAILED';
}

export interface SecurityIncident {
  readonly incidentId: string;
  readonly category: SecurityIncidentCategory;
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  readonly status: SecurityIncidentStatus;
  readonly detectedAt: number;
  readonly source: string;
  readonly affectedScope: ResourceScope;
  readonly correlationId?: string | undefined;
  readonly evidenceReference?: string | undefined;
  readonly containmentStatus: ContainmentStatus;
  readonly resolutionStatus: ResolutionStatus;
  readonly actionsTaken: readonly SecurityContainmentAction[];
  readonly details: Record<string, unknown>;
  readonly resolvedAt?: number | undefined;
}
