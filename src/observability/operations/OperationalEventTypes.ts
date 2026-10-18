export type OperationalEventType =
  | 'SERVICE_STARTED'
  | 'SERVICE_READY'
  | 'SERVICE_DEGRADED'
  | 'SERVICE_STOPPING'
  | 'DEPENDENCY_FAILED'
  | 'DEPENDENCY_RECOVERED'
  | 'MIGRATION_STARTED'
  | 'MIGRATION_COMPLETED'
  | 'MIGRATION_FAILED'
  | 'STORAGE_DEGRADED'
  | 'RUNTIME_DEGRADED'
  | 'RECOVERY_STARTED'
  | 'RECOVERY_COMPLETED';

export interface OperationalEvent {
  readonly eventId: string;
  readonly type: OperationalEventType;
  readonly component: string;
  readonly timestamp: string;
  readonly correlationId?: string | undefined;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>> | undefined;
}
