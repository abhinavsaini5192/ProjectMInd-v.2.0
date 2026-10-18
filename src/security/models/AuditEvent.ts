import type { PermissionAction } from './PermissionAction.js';
import type { ResourceType } from './ResourceType.js';

export type AuditEventType =
  | 'AUTHENTICATION_SUCCESS'
  | 'AUTHENTICATION_FAILURE'
  | 'AUTHORIZATION_ALLOW'
  | 'AUTHORIZATION_DENIAL'
  | 'ROLE_ASSIGNED'
  | 'ROLE_REVOKED'
  | 'PERMISSION_CHANGED'
  | 'IDENTITY_CREATED'
  | 'IDENTITY_DISABLED'
  | 'POLICY_CHANGED'
  | 'SECURITY_VIOLATION'
  | 'SENSITIVE_TOOL_EXECUTION'
  | 'JOB_CANCELLED'
  | 'JOB_RETRIED'
  | 'JOB_REPLAYED'
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'BACKUP_ACCESS'
  | 'CONFIG_CHANGED'
  | 'CREDENTIAL_REVOKED';

export interface AuditEvent {
  readonly eventId: string;
  readonly sequenceNumber?: number | undefined;
  readonly previousHash?: string | undefined;
  readonly hash?: string | undefined;
  readonly eventType: AuditEventType;
  readonly principalId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly resourceType?: ResourceType | undefined;
  readonly resourceId?: string | undefined;
  readonly action?: PermissionAction | string | undefined;
  readonly result: 'SUCCESS' | 'FAILURE' | 'ALLOWED' | 'DENIED';
  readonly reason?: string | undefined;
  readonly policyVersion?: string | undefined;
  readonly timestamp: string;
  readonly correlationId?: string | undefined;
  readonly details?: Record<string, unknown> | undefined;
}
