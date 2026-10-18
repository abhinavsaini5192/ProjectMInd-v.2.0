export interface DistributedEvent<T = unknown> {
  /** Globally unique event identifier */
  readonly eventId: string;
  /** Name of the event topic/channel */
  readonly eventName: string;
  /** Instance ID that originated the event */
  readonly originInstanceId: string;
  /** Idempotency key to prevent duplicate processing */
  readonly idempotencyKey: string;
  /** Epoch timestamp when event was emitted */
  readonly timestamp: number;
  /** Event payload */
  readonly payload: T;
  /** Optional correlation ID for tracing across instances */
  readonly correlationId?: string | undefined;
}
