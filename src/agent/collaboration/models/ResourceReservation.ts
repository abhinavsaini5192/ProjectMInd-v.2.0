export type ReservationResourceType =
  | 'FILE'
  | 'SYMBOL'
  | 'MODULE'
  | 'FEATURE'
  | 'API'
  | 'DATABASE_ENTITY'
  | 'CONFIGURATION'
  | 'TASK';

export type ReservationState =
  | 'UNOWNED'
  | 'OWNED'
  | 'SHARED'
  | 'RESERVED'
  | 'CONFLICTED'
  | 'STALE';

export interface ResourceReservation {
  readonly reservationId: string;
  readonly resourceType: ReservationResourceType;
  readonly resourceId: string;
  readonly ownerAgentId: string;
  readonly collaborationSessionId: string;
  readonly state: ReservationState;
  readonly reason: string;
  readonly reservedAt: number;
  readonly expiresAt: number;
  readonly isStale: boolean;
  readonly metadata?: Record<string, unknown> | undefined;
}
