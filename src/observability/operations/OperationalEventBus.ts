import { randomUUID } from 'node:crypto';
import type { IEventBus, EventHandler } from '../../workspace/interfaces/IEventBus.js';
import type { OperationalEvent, OperationalEventType } from './OperationalEventTypes.js';
import { CorrelationContext } from '../correlation/CorrelationContext.js';
import { defaultLogSanitizer, LogSanitizer } from '../logging/LogSanitizer.js';

export class OperationalEventBus {
  private static readonly EVENT_PREFIX = 'operational.';
  private readonly eventBus: IEventBus;
  private readonly sanitizer: LogSanitizer;

  constructor(eventBus: IEventBus, sanitizer: LogSanitizer = defaultLogSanitizer) {
    this.eventBus = eventBus;
    this.sanitizer = sanitizer;
  }

  public emit(
    type: OperationalEventType,
    component: string,
    message: string,
    details?: Record<string, unknown>
  ): OperationalEvent {
    const ambient = CorrelationContext.current();
    const eventId = randomUUID();
    const sanitizedDetails = details
      ? (this.sanitizer.sanitize(details) as Record<string, unknown>)
      : undefined;

    const event: OperationalEvent = {
      eventId,
      type,
      component,
      timestamp: new Date().toISOString(),
      correlationId: ambient?.correlationId,
      message: this.sanitizer.sanitizeString(message),
      details: sanitizedDetails,
    };

    const topic = `${OperationalEventBus.EVENT_PREFIX}${type.toLowerCase()}`;
    this.eventBus.publish(topic, event);
    return event;
  }

  public subscribe(
    type: OperationalEventType | '*',
    handler: (event: OperationalEvent) => void | Promise<void>
  ): () => void {
    const topic = type === '*' ? `${OperationalEventBus.EVENT_PREFIX}*` : `${OperationalEventBus.EVENT_PREFIX}${type.toLowerCase()}`;

    const wrappedHandler: EventHandler<OperationalEvent> = (evt) => {
      return handler(evt.payload);
    };

    this.eventBus.subscribe(topic, wrappedHandler);

    return () => {
      this.eventBus.unsubscribe(topic, wrappedHandler);
    };
  }
}
