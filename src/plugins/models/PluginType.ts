export type PluginType =
  | 'CONTEXT_PROVIDER'
  | 'RETRIEVAL_PROVIDER'
  | 'TOOL_PROVIDER'
  | 'AGENT_ADAPTER'
  | 'VERIFICATION_PROVIDER'
  | 'OBSERVABILITY_EXPORTER'
  | 'WORKSPACE_INTEGRATION'
  | 'CLI_EXTENSION'
  | 'GENERIC_INTEGRATION';

export const ALL_PLUGIN_TYPES: readonly PluginType[] = [
  'CONTEXT_PROVIDER',
  'RETRIEVAL_PROVIDER',
  'TOOL_PROVIDER',
  'AGENT_ADAPTER',
  'VERIFICATION_PROVIDER',
  'OBSERVABILITY_EXPORTER',
  'WORKSPACE_INTEGRATION',
  'CLI_EXTENSION',
  'GENERIC_INTEGRATION',
] as const;

export function isPluginType(val: unknown): val is PluginType {
  return typeof val === 'string' && ALL_PLUGIN_TYPES.includes(val as PluginType);
}
