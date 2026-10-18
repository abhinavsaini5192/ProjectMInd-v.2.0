import type { AgentType } from '../models/AgentType.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentResponse } from '../models/AgentResponse.js';

/**
 * Foundation contract for future provider-specific adapters (e.g., Claude Code, Cursor, Codex).
 */
export interface IAgentAdapter<TNativeRequest = unknown, TNativeResponse = unknown> {
  readonly id: string;
  readonly name: string;
  readonly targetAgentType: AgentType;
  readonly supportedProtocolVersions: readonly string[];

  adaptRequest(input: TNativeRequest): Promise<AgentRequest>;
  adaptResponse(response: AgentResponse): Promise<TNativeResponse>;
}
