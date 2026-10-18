import type { AgentRuntimeLimits } from './AgentRuntimeLimits.js';
import { DEFAULT_AGENT_RUNTIME_LIMITS } from './AgentRuntimeLimits.js';
import { type AgentRuntimeCapabilities, DEFAULT_RUNTIME_CAPABILITIES } from './AgentRuntimeCapabilities.js';

export type ContextRefreshPolicy =
  | 'IMMEDIATE'
  | 'ON_NEXT_REQUEST'
  | 'LAZY'
  | 'MANUAL';

export interface AgentRuntimeConfig {
  readonly runtimeId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly enabled: boolean;
  readonly defaultAdapterId?: string | undefined;
  readonly limits: AgentRuntimeLimits;
  readonly contextRefreshPolicy: ContextRefreshPolicy;
  readonly capabilities: AgentRuntimeCapabilities;
  readonly checkpointIntervalMs: number;
  readonly checkpointOnTaskTransition: boolean;
  readonly checkpointOnKnowledgeUpdate: boolean;
  readonly checkpointBeforeShutdown: boolean;
  readonly telemetryEnabled: boolean;
  readonly metricsEnabled: boolean;
}

export function createDefaultRuntimeConfig(
  overrides?: Partial<AgentRuntimeConfig> | string,
  workspaceId?: string,
  repositoryId?: string,
  extraOverrides?: Partial<AgentRuntimeConfig>
): AgentRuntimeConfig {
  let rId = 'runtime_default';
  let wId = 'workspace_default';
  let repId = 'repo_default';
  let configOverrides: Partial<AgentRuntimeConfig> | undefined;

  if (typeof overrides === 'string') {
    rId = overrides;
    wId = workspaceId ?? 'workspace_default';
    repId = repositoryId ?? 'repo_default';
    configOverrides = extraOverrides;
  } else {
    configOverrides = overrides;
    if (configOverrides?.runtimeId) rId = configOverrides.runtimeId;
    if (configOverrides?.workspaceId) wId = configOverrides.workspaceId;
    if (configOverrides?.repositoryId) repId = configOverrides.repositoryId;
  }

  return {
    runtimeId: rId,
    workspaceId: wId,
    repositoryId: repId,
    enabled: configOverrides?.enabled ?? true,
    defaultAdapterId: configOverrides?.defaultAdapterId,
    limits: {
      ...DEFAULT_AGENT_RUNTIME_LIMITS,
      ...(configOverrides?.limits ?? {}),
    },
    contextRefreshPolicy: configOverrides?.contextRefreshPolicy ?? 'ON_NEXT_REQUEST',
    capabilities: {
      ...DEFAULT_RUNTIME_CAPABILITIES,
      ...(configOverrides?.capabilities ?? {}),
    },
    checkpointIntervalMs: configOverrides?.checkpointIntervalMs ?? 60000,
    checkpointOnTaskTransition: configOverrides?.checkpointOnTaskTransition ?? true,
    checkpointOnKnowledgeUpdate: configOverrides?.checkpointOnKnowledgeUpdate ?? true,
    checkpointBeforeShutdown: configOverrides?.checkpointBeforeShutdown ?? true,
    telemetryEnabled: configOverrides?.telemetryEnabled ?? true,
    metricsEnabled: configOverrides?.metricsEnabled ?? true,
  };
}
