import crypto from 'node:crypto';
import type {
  IResourceReservationService,
  ReservationParams,
} from '../interfaces/IResourceReservationService.js';
import type { ICollaborationStore } from '../interfaces/ICollaborationStore.js';
import type { ResourceReservation } from '../models/index.js';
import {
  CollaborationConflictError,
  CollaborationError,
} from '../errors/CollaborationError.js';
import type { IResourceLockManager } from '../../../concurrency/locking/IResourceLockManager.js';

export class ResourceReservationService implements IResourceReservationService {
  private static readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly store: ICollaborationStore,
    private readonly lockManager?: IResourceLockManager | undefined
  ) {}

  public async reserve(params: ReservationParams): Promise<ResourceReservation> {
    const now = Date.now();
    const ttl = params.ttlMs ?? ResourceReservationService.DEFAULT_TTL_MS;

    // Check existing active reservations for this resource
    const existingList = await this.store.listReservations({
      collaborationSessionId: params.collaborationSessionId,
      resourceId: params.resourceId,
    });

    for (const res of existingList) {
      const isExpired = res.expiresAt <= now;
      if (!isExpired && !res.isStale && res.state !== 'UNOWNED') {
        if (res.ownerAgentId === params.ownerAgentId) {
          // Re-affirm / renew for current owner
          const renewed: ResourceReservation = {
            ...res,
            reason: params.reason,
            expiresAt: now + ttl,
            reservedAt: now,
            state: 'RESERVED',
          };
          await this.store.saveReservation(renewed);
          return renewed;
        }

        // Active reservation owned by another agent
        throw new CollaborationConflictError(
          `Resource '${params.resourceId}' is currently reserved by agent '${res.ownerAgentId}' until ${new Date(res.expiresAt).toISOString()}`,
          {
            resourceId: params.resourceId,
            conflictingAgentId: res.ownerAgentId,
            expiresAt: res.expiresAt,
            existingReservationId: res.reservationId,
          }
        );
      }
    }

    const reservationId = `resv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const reservation: ResourceReservation = {
      reservationId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      ownerAgentId: params.ownerAgentId,
      collaborationSessionId: params.collaborationSessionId,
      state: 'RESERVED',
      reason: params.reason,
      reservedAt: now,
      expiresAt: now + ttl,
      isStale: false,
    };

    await this.store.saveReservation(reservation);
    return reservation;
  }

  public async release(reservationId: string, agentId: string): Promise<boolean> {
    const res = await this.store.getReservation(reservationId);
    if (!res) return false;

    if (res.ownerAgentId !== agentId) {
      throw new CollaborationError(
        `Agent '${agentId}' cannot release reservation '${reservationId}' owned by '${res.ownerAgentId}'`,
        'RESERVATION_OWNER_MISMATCH'
      );
    }

    const released: ResourceReservation = {
      ...res,
      state: 'UNOWNED',
      isStale: false,
      expiresAt: Date.now(),
    };
    await this.store.saveReservation(released);
    return true;
  }

  public async renew(
    reservationId: string,
    agentId: string,
    ttlMs?: number
  ): Promise<ResourceReservation> {
    const res = await this.store.getReservation(reservationId);
    if (!res) {
      throw new CollaborationError(
        `Reservation '${reservationId}' not found for renewal`,
        'RESERVATION_NOT_FOUND'
      );
    }

    if (res.ownerAgentId !== agentId) {
      throw new CollaborationError(
        `Agent '${agentId}' cannot renew reservation '${reservationId}' owned by '${res.ownerAgentId}'`,
        'RESERVATION_OWNER_MISMATCH'
      );
    }

    const ttl = ttlMs ?? ResourceReservationService.DEFAULT_TTL_MS;
    const now = Date.now();
    const renewed: ResourceReservation = {
      ...res,
      expiresAt: now + ttl,
      isStale: false,
      state: 'RESERVED',
    };

    await this.store.saveReservation(renewed);
    return renewed;
  }

  public async inspect(
    resourceId: string,
    collaborationSessionId?: string
  ): Promise<ResourceReservation | null> {
    const list = await this.store.listReservations({
      resourceId,
      collaborationSessionId,
      activeOnly: true,
    });
    return list.length > 0 ? list[0]! : null;
  }

  public async listStaleReservations(collaborationSessionId?: string): Promise<ResourceReservation[]> {
    const all = await this.store.listReservations({ collaborationSessionId });
    const now = Date.now();
    return all.filter((r) => (r.expiresAt <= now || r.isStale) && r.state !== 'UNOWNED');
  }

  public async purgeStale(options?: { markStaleOnly?: boolean }): Promise<string[]>{
    const stale = await this.listStaleReservations();
    const affectedIds: string[] = [];

    for (const r of stale) {
      affectedIds.push(r.reservationId);
      if (options?.markStaleOnly) {
        await this.store.saveReservation({
          ...r,
          isStale: true,
          state: 'STALE',
        });
      } else {
        await this.store.saveReservation({
          ...r,
          isStale: true,
          state: 'UNOWNED',
        });
      }
    }

    return affectedIds;
  }
}
