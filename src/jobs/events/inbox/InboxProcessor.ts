import type { ITransactionalInbox } from './ITransactionalInbox.js';
import { CorrelationContext } from '../../../observability/correlation/CorrelationContext.js';

export interface InboundEventEnvelope<T = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateSeq?: number | undefined;
  readonly correlationId?: string | undefined;
  readonly causationId?: string | undefined;
  readonly traceId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly organizationId?: string | undefined;
  readonly data: T;
}

export type EventHandlerFn<T = Record<string, unknown>> = (
  event: InboundEventEnvelope<T>
) => Promise<Record<string, unknown> | void>;

export class InboxProcessor {
  private readonly inbox: ITransactionalInbox;
  private readonly consumerName: string;

  constructor(inbox: ITransactionalInbox, consumerName: string) {
    this.inbox = inbox;
    this.consumerName = consumerName;
  }

  public async processEvent<T = Record<string, unknown>>(
    event: InboundEventEnvelope<T>,
    handler: EventHandlerFn<T>
  ): Promise<{ processed: boolean; duplicate: boolean; outOfOrder: boolean; result?: Record<string, unknown> }> {
    // 1. Deduplication check
    const alreadyProcessed = await this.inbox.isProcessed(event.eventId, this.consumerName);
    if (alreadyProcessed) {
      return { processed: false, duplicate: true, outOfOrder: false };
    }

    // 2. Aggregate sequence verification
    const seq = event.aggregateSeq ?? 1;
    let outOfOrder = false;

    if (seq > 1) {
      const lastSeq = await this.inbox.getLastProcessedSeq(
        this.consumerName,
        event.aggregateType,
        event.aggregateId
      );
      if (seq > lastSeq + 1) {
        outOfOrder = true;
      }
    }

    // 3. Execute handler within ambient CorrelationContext
    const eventContext = CorrelationContext.createChildContext({
      correlationId: event.correlationId,
      causationId: event.causationId ?? event.eventId,
      traceId: event.traceId,
      aggregateId: event.aggregateId,
      workspaceId: event.workspaceId,
      organizationId: event.organizationId,
    });

    return await CorrelationContext.run(eventContext, async () => {
      try {
        const res = await handler(event);
        await this.inbox.recordProcessed({
          eventId: event.eventId,
          consumerName: this.consumerName,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          aggregateSeq: seq,
          status: 'PROCESSED',
          result: res || undefined,
        });

        return {
          processed: true,
          duplicate: false,
          outOfOrder,
          result: res || undefined,
        };
      } catch (err) {
        await this.inbox.recordProcessed({
          eventId: event.eventId,
          consumerName: this.consumerName,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          aggregateSeq: seq,
          status: 'FAILED',
          result: { error: err instanceof Error ? err.message : String(err) },
        });
        throw err;
      }
    });
  }
}

