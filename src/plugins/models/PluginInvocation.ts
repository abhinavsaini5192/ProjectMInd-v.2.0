import type { PluginCapability } from './PluginCapability.js';

export interface PluginInvocationRequest {
  readonly pluginId: string;
  readonly operation: string;
  readonly payload: unknown;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly correlationId: string;
  readonly requestVersion: string;
  readonly timeoutMs?: number | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly requiredCapabilities?: readonly PluginCapability[] | undefined;
}

export interface PluginInvocationResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T | undefined;
  readonly error?: string | undefined;
  readonly errorCategory?: string | undefined;
  readonly durationMs: number;
  readonly correlationId: string;
}
