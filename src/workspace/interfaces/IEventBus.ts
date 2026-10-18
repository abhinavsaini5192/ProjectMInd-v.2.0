import { ProjectMindEvent } from '../types/WorkspaceEvents';

export interface EventSubscription {
  unsubscribe(): void;
}

export type EventHandler<T = any> = (event: ProjectMindEvent<T>) => void | Promise<void>;

export interface IEventBus {
  publish<T>(eventName: string, payload: T): void;
  emit?<T>(eventName: string, payload: T): void;
  subscribe<T>(eventName: string, handler: EventHandler<T>): void;
  unsubscribe<T>(eventName: string, handler: EventHandler<T>): void;
}

export const IEventBusToken = Symbol('IEventBus');
