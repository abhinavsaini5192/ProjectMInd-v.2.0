/**
 * Technical capability disclosed by an external agent or adapter.
 * Distinct from permission (which is what the security system authorizes).
 */
export interface Capability {
  readonly name: string;
  readonly description?: string | undefined;
  readonly supportedProtocols?: readonly string[] | undefined;
}

export type StandardCapability =
  | 'READ_CONTEXT'
  | 'REFRESH_CONTEXT'
  | 'EXECUTE_TOOL'
  | 'REPORT_EXECUTION'
  | 'REPORT_VERIFICATION'
  | 'UPDATE_KNOWLEDGE'
  | 'SUBSCRIBE_EVENTS'
  | 'MCP_INTERACTION';
