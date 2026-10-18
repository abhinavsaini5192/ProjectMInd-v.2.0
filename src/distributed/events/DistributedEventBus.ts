import { randomUUID } from 'node:crypto';
import type { IEventBus, EventHandler, EventSubscription } from '../../workspace/interfaces/IEventBus.js';
import type { ProjectMindEvent } from '../../workspace/types/WorkspaceEvents.js';
import type { IDistributedCoordinationBackend, BackendSubscription } from '../coordination/IDistributedCoordinationBackend.js';
import type { DistributedEvent } from '../models/DistributedEvent.js';

export class DistributedEventBus implements IEventBus {
  private readonly localBus: IEventBus;
  private readonly backend?: IDistributedCoordinationBackend | undefined;
  private readonly instanceId: string;
  private readonly clusterChannel: string;
  private readonly seenEventIds = new Map<string, number>(); // eventId -> expiresAt
  private backendSubscription: BackendSubscription | null = null;
  private isClosed = false;

  constructor(
    localBus: IEventBus,
    instanceId: string,
    backend?: IDistributedCoordinationBackend,
    clusterChannel: string = 'pm:cluster:events'
  ) {
    this.localBus = localBus;
    this.instanceId = instanceId;
    this.backend = backend;
    this.clusterChannel = clusterChannel;
  }

  public async initialize(): Promise<void> {
    if (!this.backend) return;

    try {
      this.backendSubscription = await this.backend.subscribe(
        this.clusterChannel,
        (rawMessage: string) => {
          this.handleInboundClusterMessage(rawMessage);
        }
      );
    } catch {
      // Backend pubsub failed; fallback to local-only bus
    }
  }

  private handleInboundClusterMessage(rawMessage: string): void {
    if (this.isClosed) return;

    try {
      const event: DistributedEvent = JSON.parse(rawMessage);

      // 1. Ignore echo (events emitted by this instance)
      if (event.originInstanceId === this.instanceId) {
        return;
      }

      // 2. Deduplicate using idempotency key / eventId
      const dedupKey = event.idempotencyKey || event.eventId;
      const now = Date.now();
      const existing = this.seenEventIds.get(dedupKey);
      if (existing && existing > now) {
        return; // Already processed
      }

      // Record seen (expires after 60 seconds)
      this.seenEventIds.set(dedupKey, now + 60000);
      this.pruneSeenEventIds(now);

      // 3. Dispatch to local subscribers
      this.localBus.publish(event.eventName, event.payload);
    } catch {
      // Ignore unparseable messages
    }
  }

  private pruneSeenEventIds(now: number): void {
    if (this.seenEventIds.size > 2000) {
      for (const [id, exp] of this.seenEventIds.entries()) {
        if (exp <= now) this.seenEventIds.delete(id);
      }
    }
  }

  public publish<T>(eventName: string, payload: T): void {
    // 1. Dispatch locally immediately
    this.localBus.publish(eventName, payload);

    // 2. Broadcast to cluster peers if backend is available
    if (this.backend && !this.isClosed) {
      const eventId = `evt-${randomUUID()}`;
      const distEvent: DistributedEvent<T> = {
        eventId,
        eventName,
        originInstanceId: this.instanceId,
        idempotencyKey: eventId,
        timestamp: Date.now(),
        payload,
      };

      // Record self to avoid echo if backend reflects messages
      this.seenEventIds.set(eventId, Date.now() + 60000);

      this.backend.publish(this.clusterChannel, JSON.stringify(distEvent)).catch(() => {
        // Pub/sub delivery best effort
      });
    }
  }

  public subscribe<T>(eventName: string, handler: EventHandler<T>): void {
    this.localBus.subscribe(eventName, handler);
  }

  public unsubscribe<T>(eventName: string, handler: EventHandler<T>): void {
    this.localBus.unsubscribe(eventName, handler);
  }

  public async close(): Promise<void> {
    this.isClosed = true;
    if (this.backendSubscription) {
      try {
        await this.backendSubscription.unsubscribe();
      } catch {}
      this.backendSubscription = null;
    }
    this.seenEventIds.clear();
  }
}
