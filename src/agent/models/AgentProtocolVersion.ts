export const AGENT_PROTOCOL_VERSION_1_0 = '1.0';
export const CURRENT_AGENT_PROTOCOL_VERSION = AGENT_PROTOCOL_VERSION_1_0;

export const SUPPORTED_AGENT_PROTOCOL_VERSIONS = [AGENT_PROTOCOL_VERSION_1_0] as const;

export function isSupportedProtocolVersion(version: string): boolean {
  return (SUPPORTED_AGENT_PROTOCOL_VERSIONS as readonly string[]).includes(version);
}
