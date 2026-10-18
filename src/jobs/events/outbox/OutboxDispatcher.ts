import type { ITransactionalOutbox } from './ITransactionalOutbox.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { CorrelationContext } from '../../../observability/correlation/CorrelationContext.js';

export interface OutboxDispatcherOptions {
  readonly batchSize?: number | undefined;
  readonly pollIntervalMs?: number | undefined;
  readonly maxRetries?: number | undefined;
}

export class OutboxDispatcher {
  private readonly outbox: ITransactionalOutbox;
  private readonly eventBus: IEventBus;
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    outbox: ITransactionalOutbox,
    eventBus: IEventBus,
    options: OutboxDispatcherOptions = {}
  ) {
    this.outbox = outbox;
    this.eventBus = eventBus;
    this.batchSize = options.batchSize ?? 50;
    this.pollIntervalMs = options.pollIntervalMs ?? 100;
  }

  public async dispatchBatch(): Promise<number> {
    const events = await this.outbox.fetchPendingEvents(this.batchSize);
    let dispatchedCount = 0;

    for (const event of events) {
      try {
        const eventContext = CorrelationContext.createChildContext({
          correlationId: event.correlationId,
          causationId: event.causationId ?? event.eventId,
          eventId: event.eventId,
          aggregateId: event.aggregateId,
          workspaceId: event.workspaceId,
          organizationId: event.organizationId,
          role: 'scheduler',
        });

        await CorrelationContext.run(eventContext, async () => {
          // Publish to event bus
          this.eventBus.publish(event.eventType, {
            eventId: event.eventId,
            eventType: event.eventType,
            schemaVersion: event.schemaVersion,
            workspaceId: event.workspaceId,
            organizationId: event.organizationId,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            aggregateSeq: event.aggregateSeq,
            correlationId: event.correlationId,
            causationId: event.causationId,
            createdAt: event.createdAt,
            data: event.payload,
          });

          await this.outbox.markDispatched(event.eventId);
        });
        dispatchedCount++;
      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.outbox.recordFailure(event.eventId, errorMsg, 2000);
      }
    }

    return dispatchedCount;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const loop = async () => {
      if (!this.isRunning) return;
      try {
        await this.dispatchBatch();
      } catch {}
      if (this.isRunning) {
        this.timer = setTimeout(loop, this.pollIntervalMs);
      }
    };

    this.timer = setTimeout(loop, this.pollIntervalMs);
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
