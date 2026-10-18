import type { AgentRegistrationParams } from '../../../agent/models/Agent.js';
import type { AgentType } from '../../../agent/models/AgentType.js';
import { AGENT_CAPABILITIES } from '../../../agent/models/AgentCapability.js';
import type { McpClientInfo } from '../protocol/McpTypes.js';

/**
 * Maps external MCP client metadata to canonical ProjectMind Agent identity.
 */
export class McpIdentityMapper {
  /**
   * Translates client information reported during MCP handshake to AgentRegistrationParams.
   */
  public static mapClientToAgent(
    clientInfo?: McpClientInfo | undefined,
    defaultAgentId?: string | undefined
  ): AgentRegistrationParams {
    const rawName = clientInfo?.name?.trim() || 'mcp-client';
    const rawVersion = clientInfo?.version?.trim() || '1.0.0';
    const lowerName = rawName.toLowerCase();

    // Determine agent type
    let agentType: AgentType = 'CODING_AGENT';
    if (
      lowerName.includes('cursor') ||
      lowerName.includes('windsurf') ||
      lowerName.includes('vscode') ||
      lowerName.includes('ide') ||
      lowerName.includes('desktop')
    ) {
      agentType = 'IDE_AGENT';
    } else if (
      lowerName.includes('cli') ||
      lowerName.includes('terminal') ||
      lowerName.includes('shell')
    ) {
      agentType = 'CLI_AGENT';
    } else if (lowerName.includes('automation') || lowerName.includes('bot')) {
      agentType = 'AUTOMATION_AGENT';
    }

    // Determine vendor
    let vendor: string = 'External MCP Client';
    if (lowerName.includes('claude')) {
      vendor = 'Anthropic';
    } else if (lowerName.includes('cursor')) {
      vendor = 'Anysphere';
    } else if (lowerName.includes('windsurf')) {
      vendor = 'Codeium';
    } else if (lowerName.includes('copilot') || lowerName.includes('github')) {
      vendor = 'GitHub';
    }

    const sanitizedSlug = lowerName.replace(/[^a-z0-9_-]/g, '-');
    const agentId = defaultAgentId ?? `mcp-${sanitizedSlug}`;

    return {
      agentId,
      name: rawName,
      type: agentType,
      version: rawVersion,
      vendor,
      description: `External AI coding agent connected via MCP (${rawName} v${rawVersion})`,
      trustLevel: 'LIMITED',
      capabilities: [...AGENT_CAPABILITIES],
      metadata: {
        protocol: 'mcp',
        clientName: rawName,
        clientVersion: rawVersion,
      },
    };
  }
}
