/**
 * Phase 7.1 Architecture boundary constants and definitions.
 *
 * ProjectMind provides repository intelligence, feature knowledge, context orchestration,
 * and knowledge updates. It is NOT an arbitrary code executor or shell runner.
 */
export const AGENT_ARCHITECTURE_LAYER = 'AGENT_INTEGRATION_BOUNDARY';

export const PROHIBITED_CAPABILITIES = [
  'EXECUTE_SHELL_COMMAND',
  'MODIFY_FILE_SYSTEM_DIRECTLY',
  'BYPASS_SECURITY_POLICIES',
  'ARBITRARY_CODE_EXECUTION',
] as const;

export interface AgentArchitectureBoundaryInfo {
  readonly layer: string;
  readonly supportedProtocolVersions: readonly string[];
  readonly provides: readonly string[];
  readonly nonGoals: readonly string[];
}

export const AGENT_ARCHITECTURE_BOUNDARY: AgentArchitectureBoundaryInfo = {
  layer: AGENT_ARCHITECTURE_LAYER,
  supportedProtocolVersions: ['1.0'],
  provides: [
    'Repository Intelligence Access',
    'Feature Knowledge Retrieval',
    'Context Orchestration & Token Budgeting',
    'Change Impact & Architecture Querying',
    'Verification & Execution Reporting',
    'Curated Knowledge Ingestion',
  ],
  nonGoals: [
    'Autonomous Code Execution',
    'Shell/Terminal Process Execution',
    'Uncontrolled Direct File Modifications',
    'Agent Authentication/Identity Provider Implementation',
  ],
};
