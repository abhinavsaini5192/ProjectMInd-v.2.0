import type { PluginState } from '../models/PluginState.js';

export const PluginEventNames = {
  PLUGIN_REGISTERED: 'plugin.registered',
  PLUGIN_VALIDATED: 'plugin.validated',
  PLUGIN_INSTALLED: 'plugin.installed',
  PLUGIN_ENABLED: 'plugin.enabled',
  PLUGIN_DISABLED: 'plugin.disabled',
  PLUGIN_FAILED: 'plugin.failed',
  PLUGIN_PERMISSION_GRANTED: 'plugin.permission_granted',
  PLUGIN_PERMISSION_REVOKED: 'plugin.permission_revoked',
  PLUGIN_CONFIGURATION_UPDATED: 'plugin.configuration_updated',
  PLUGIN_COMPATIBILITY_FAILED: 'plugin.compatibility_failed',
  PLUGIN_INVOCATION_STARTED: 'plugin.invocation_started',
  PLUGIN_INVOCATION_COMPLETED: 'plugin.invocation_completed',
  PLUGIN_INVOCATION_FAILED: 'plugin.invocation_failed',
  PLUGIN_UNINSTALLED: 'plugin.uninstalled',
} as const;

export interface BasePluginEventPayload {
  readonly pluginId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly timestamp: string;
}

export interface PluginRegisteredEventPayload extends BasePluginEventPayload {
  readonly version: string;
  readonly pluginType: string;
  readonly publisher: string;
}

export interface PluginLifecycleEventPayload extends BasePluginEventPayload {
  readonly fromState: PluginState;
  readonly toState: PluginState;
  readonly error?: string | undefined;
}

export interface PluginPermissionEventPayload extends BasePluginEventPayload {
  readonly capabilities: readonly string[];
  readonly permissions: readonly string[];
  readonly approvedBy: string;
}

export interface PluginInvocationEventPayload extends BasePluginEventPayload {
  readonly operation: string;
  readonly correlationId: string;
  readonly durationMs?: number | undefined;
  readonly success?: boolean | undefined;
  readonly error?: string | undefined;
}
