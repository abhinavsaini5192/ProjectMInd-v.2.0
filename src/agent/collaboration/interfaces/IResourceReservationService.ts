import type {
  ResourceReservation,
  ReservationResourceType,
} from '../models/index.js';

export interface ReservationParams {
  readonly collaborationSessionId: string;
  readonly ownerAgentId: string;
  readonly resourceType: ReservationResourceType;
  readonly resourceId: string;
  readonly reason: string;
  readonly ttlMs?: number | undefined;
}

export interface IResourceReservationService {
  reserve(params: ReservationParams): Promise<ResourceReservation>;
  release(reservationId: string, agentId: string): Promise<boolean>;
  renew(reservationId: string, agentId: string, ttlMs?: number): Promise<ResourceReservation>;
  inspect(resourceId: string, collaborationSessionId?: string): Promise<ResourceReservation | null>;
  listStaleReservations(collaborationSessionId?: string): Promise<ResourceReservation[]>;
  purgeStale(options?: { markStaleOnly?: boolean }): Promise<string[]>;
}
