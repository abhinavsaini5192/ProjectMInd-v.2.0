import type { PluginInvocationRequest, PluginInvocationResult } from '../models/PluginInvocation.js';

export interface IPluginLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface IPluginEventBridge {
  subscribe(eventType: string, handler: (payload: unknown) => void | Promise<void>): () => void;
  publish(eventType: string, payload: unknown): Promise<void>;
}

export interface IPluginExecutionContext {
  readonly pluginId: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly config: Readonly<Record<string, unknown>>;
  readonly logger: IPluginLogger;
  readonly events: IPluginEventBridge;
}

export interface PluginHealthReport {
  readonly status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  readonly message?: string | undefined;
  readonly checkedAt: string;
  readonly metrics?: Record<string, number | string> | undefined;
}

export interface IPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  validate?(config?: Record<string, unknown>): Promise<boolean>;
  initialize(context: IPluginExecutionContext): Promise<void>;
  configure?(config: Record<string, unknown>): Promise<void>;
  healthCheck?(): Promise<PluginHealthReport>;
  invoke(request: PluginInvocationRequest): Promise<PluginInvocationResult>;
  shutdown?(): Promise<void>;
}
