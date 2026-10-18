import type { IEventBus, EventHandler } from '../../workspace/interfaces/IEventBus.js';
import type { IJobDispatcher } from './IJobDispatcher.js';
import type { JobType } from '../models/JobType.js';

export interface EventJobMapping {
  readonly eventName: string;
  readonly jobType: JobType;
  readonly extractParams: (payload: any) => {
    readonly workspaceId: string;
    readonly repositoryId?: string | undefined;
    readonly payload: Record<string, unknown>;
    readonly idempotencyKey?: string | undefined;
    readonly correlationId?: string | undefined;
  };
}

export class EventJobRouter {
  private readonly unbindFns: Array<() => void> = [];
  private readonly processedEvents = new Set<string>();

  constructor(
    private readonly eventBus: IEventBus,
    private readonly dispatcher: IJobDispatcher
  ) {}

  public registerRoute(mapping: EventJobMapping): void {
    const handler: EventHandler = async (event) => {
      // Event deduplication check
      const eventName = event.name || (event as any).type || 'unknown';
      const eventId = (event as any).id || (event.payload as any)?.eventId || (event.payload as any)?.id || event.timestamp;
      const eventKey = `${eventName}:${eventId}`;
      if (this.processedEvents.has(eventKey)) {
        return;
      }
      this.processedEvents.add(eventKey);
      if (this.processedEvents.size > 5000) {
        const first = this.processedEvents.values().next().value;
        if (first) this.processedEvents.delete(first);
      }

      try {
        const params = mapping.extractParams(event.payload);
        await this.dispatcher.dispatch({
          type: mapping.jobType,
          workspaceId: params.workspaceId,
          repositoryId: params.repositoryId,
          payload: params.payload,
          idempotencyKey: params.idempotencyKey ?? `evt-${eventId}`,
          correlationId: params.correlationId,
        });
      } catch {
        // Router fail-safe isolation
      }
    };

    this.eventBus.subscribe(mapping.eventName, handler);
    this.unbindFns.push(() => this.eventBus.unsubscribe(mapping.eventName, handler));
  }

  public registerDefaultRoutes(): void {
    // 1. Knowledge Observation Event -> AGENT_OBSERVATION_PROCESSING
    this.registerRoute({
      eventName: 'knowledge.observation.created',
      jobType: 'AGENT_OBSERVATION_PROCESSING',
      extractParams: (payload) => ({
        workspaceId: payload.workspaceId ?? 'default-ws',
        repositoryId: payload.repositoryId,
        payload: { observationId: payload.observationId, data: payload.data },
        idempotencyKey: payload.observationId ? `obs-${payload.observationId}` : undefined,
        correlationId: payload.correlationId,
      }),
    });

    // 2. Context Invalidation Event -> CONTEXT_REFRESH
    this.registerRoute({
      eventName: 'context.invalidated',
      jobType: 'CONTEXT_REFRESH',
      extractParams: (payload) => ({
        workspaceId: payload.workspaceId ?? 'default-ws',
        repositoryId: payload.repositoryId,
        payload: { reason: payload.reason, contextKey: payload.contextKey },
        idempotencyKey: payload.contextKey ? `ctx-refresh-${payload.contextKey}` : undefined,
        correlationId: payload.correlationId,
      }),
    });

    // 3. Verification Completed Event -> VERIFICATION_PROCESSING
    this.registerRoute({
      eventName: 'verification.completed',
      jobType: 'VERIFICATION_PROCESSING',
      extractParams: (payload) => ({
        workspaceId: payload.workspaceId ?? 'default-ws',
        repositoryId: payload.repositoryId,
        payload: { verificationId: payload.verificationId, passed: payload.passed },
        idempotencyKey: payload.verificationId ? `verif-${payload.verificationId}` : undefined,
        correlationId: payload.correlationId,
      }),
    });
  }

  public stop(): void {
    for (const unbind of this.unbindFns) {
      unbind();
    }
    this.unbindFns.length = 0;
    this.processedEvents.clear();
  }
}
