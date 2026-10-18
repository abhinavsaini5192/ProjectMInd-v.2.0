import type { IAgentAdapter } from '../interfaces/IAgentAdapter.js';
import type { AdapterMetadata } from '../models/AdapterMetadata.js';
import type { AgentAdapterStatus } from '../models/AgentAdapterStatus.js';
import type { AdapterCapability } from '../models/AdapterCapability.js';
import type { AdapterCompatibilityResult } from '../models/AdapterCompatibilityResult.js';
import type { AdapterRequest } from '../models/AdapterRequest.js';
import type { AdapterResponse } from '../models/AdapterResponse.js';
import type { AdapterContext } from '../models/AdapterContext.js';
import type { AdapterSession } from '../models/AdapterSession.js';
import type { AgentRequest } from '../../models/AgentRequest.js';
import type { AgentResponse } from '../../models/AgentResponse.js';
import type { AgentType } from '../../models/AgentType.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ContextPackage } from '../../../context/models/ContextPackage.js';
import type { IMcpToolAdapter } from '../../../integrations/mcp/adapters/IMcpToolAdapter.js';

import { AgentCapabilityMapper } from '../core/AgentCapabilityMapper.js';
import { AgentContextMapper } from '../core/AgentContextMapper.js';
import { AgentSessionMapper } from '../core/AgentSessionMapper.js';
import { AgentProtocolTranslator } from '../core/AgentProtocolTranslator.js';
import { McpSchemaTranslator } from '../../../integrations/mcp/schemas/McpSchemaTranslator.js';

export interface McpAgentAdapterOptions {
  metadataOverride?: Partial<AdapterMetadata> | undefined;
  toolAdapter?: IMcpToolAdapter | undefined;
}

export class McpAgentAdapter implements IAgentAdapter {
  public readonly metadata: AdapterMetadata;
  public status: AgentAdapterStatus = 'UNINITIALIZED';

  private readonly toolAdapter?: IMcpToolAdapter | undefined;
  private readonly capabilityMapper = new AgentCapabilityMapper();
  private readonly contextMapper = new AgentContextMapper();
  private readonly sessionMapper = new AgentSessionMapper();
  private readonly protocolTranslator = new AgentProtocolTranslator();

  constructor(options?: McpAgentAdapterOptions) {
    this.toolAdapter = options?.toolAdapter;
    this.metadata = {
      adapterId: options?.metadataOverride?.adapterId ?? 'mcp_agent_adapter',
      name: options?.metadataOverride?.name ?? 'MCP Protocol Adapter',
      adapterVersion: options?.metadataOverride?.adapterVersion ?? '1.0.0',
      protocolVersion: options?.metadataOverride?.protocolVersion ?? '2024-11-05',
      provider: options?.metadataOverride?.provider ?? 'GENERIC',
      protocol: 'MCP',
      type: 'MCP',
      status: 'UNINITIALIZED',
      capabilities: options?.metadataOverride?.capabilities ?? [
        'TOOL_CALLING',
        'MCP',
        'CONTEXT_RETRIEVAL',
        'FEATURE_RETRIEVAL',
        'IMPACT_RETRIEVAL',
        'HISTORY_RETRIEVAL',
        'HEALTH_RETRIEVAL',
        'STRUCTURED_OUTPUT',
        'SESSION_STATE',
      ],
      supportedAgentType: options?.metadataOverride?.supportedAgentType ?? 'AUTOMATION_AGENT',
      limits: options?.metadataOverride?.limits ?? {
        maxRequestSizeBytes: 10 * 1024 * 1024,
        maxResponseSizeBytes: 10 * 1024 * 1024,
      },
      createdAt: Date.now(),
    };
  }

  public get id(): string {
    return this.metadata.adapterId;
  }

  public get name(): string {
    return this.metadata.name;
  }

  public get targetAgentType(): AgentType | undefined {
    return this.metadata.supportedAgentType;
  }

  public get supportedProtocolVersions(): readonly string[] {
    return [this.metadata.protocolVersion, '1.0'];
  }

  public async initialize(): Promise<void> {
    this.status = 'INITIALIZING';
    this.status = 'READY';
  }

  public async shutdown(): Promise<void> {
    this.status = 'SHUTTING_DOWN';
    this.sessionMapper.clear();
    this.status = 'STOPPED';
  }

  public checkCompatibility(
    protocolVersion: string,
    capabilities?: readonly AdapterCapability[]
  ): AdapterCompatibilityResult {
    return this.capabilityMapper.assessCompatibility(this.metadata, protocolVersion, capabilities);
  }

  public async translateRequest(rawRequest: any): Promise<AdapterRequest> {
    if (!rawRequest) {
      throw new Error('rawRequest must be defined');
    }

    // Handle MCP JSON-RPC call
    if (rawRequest.method === 'tools/call') {
      const params = rawRequest.params ?? {};
      const toolName = params.name;
      const args = params.arguments ?? {};
      const workspaceContext = args.workspaceContext ?? {
        workspaceId: args.workspaceId ?? 'default',
        repositoryId: args.repositoryId ?? 'default',
      };

      return {
        requestId: String(rawRequest.id ?? `mcp_${Date.now()}`),
        adapterId: this.id,
        protocol: 'MCP',
        protocolVersion: this.metadata.protocolVersion,
        operation: 'REPORT_EXECUTION',
        agentId: `mcp_client_${this.id}`,
        sessionId: rawRequest.sessionId,
        workspaceContext,
        payload: {
          toolName,
          arguments: args,
        },
        timestamp: new Date().toISOString(),
        metadata: {
          provider: this.metadata.provider,
          protocol: 'MCP',
          mcpMethod: rawRequest.method,
        },
      };
    }

    // Direct adapter request
    if (rawRequest.requestId && rawRequest.workspaceContext) {
      return {
        ...rawRequest,
        adapterId: this.id,
        protocol: 'MCP',
        agentId: rawRequest.agentId ?? `mcp_client_${this.id}`,
        metadata: {
          ...rawRequest.metadata,
          provider: this.metadata.provider,
          protocol: 'MCP',
        },
      };
    }

    // Fallback normalization
    return {
      requestId: String(rawRequest.id ?? `mcp_${Date.now()}`),
      adapterId: this.id,
      protocol: 'MCP',
      protocolVersion: this.metadata.protocolVersion,
      operation: rawRequest.operation ?? 'GET_CONTEXT',
      agentId: rawRequest.agentId ?? `mcp_client_${this.id}`,
      sessionId: rawRequest.sessionId,
      workspaceContext: rawRequest.workspaceContext ?? {
        workspaceId: rawRequest.workspaceId ?? 'default',
        repositoryId: rawRequest.repositoryId ?? 'default',
      },
      payload: rawRequest.params ?? rawRequest.payload ?? rawRequest,
      timestamp: new Date().toISOString(),
      metadata: {
        provider: this.metadata.provider,
        protocol: 'MCP',
      },
    };
  }

  public async translateResponse(
    canonicalResponse: AgentResponse,
    requestEnvelope?: AdapterRequest
  ): Promise<AdapterResponse> {
    // If request was MCP tools/call, format content array per MCP specification
    const isMcpCall = requestEnvelope?.metadata?.mcpMethod === 'tools/call';

    if (isMcpCall) {
      const isError = canonicalResponse.status === 'ERROR';
      const mcpResult = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(isError ? canonicalResponse.error : canonicalResponse.data),
          },
        ],
        isError,
      };

      return {
        requestId: canonicalResponse.requestId,
        adapterId: this.id,
        status: canonicalResponse.status,
        data: mcpResult,
        error: canonicalResponse.error
          ? {
              code: canonicalResponse.error.code,
              message: canonicalResponse.error.message,
              retryable: false,
              severity: 'ERROR',
            }
          : undefined,
        warnings: [],
        metadata: {
          adapterVersion: this.metadata.adapterVersion,
          protocolVersion: this.metadata.protocolVersion,
          durationMs: canonicalResponse.metadata?.durationMs ?? 0,
          timestamp: new Date().toISOString(),
        },
      };
    }

    return this.protocolTranslator.fromCanonicalResponse(canonicalResponse, requestEnvelope);
  }

  public mapTool(tool: AgentTool): unknown {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: McpSchemaTranslator.translateInputSchema(tool.inputSchema),
    };
  }

  public mapContext(context: ContextPackage, targetFormat?: string): AdapterContext {
    return this.contextMapper.mapContext(context, { format: targetFormat ?? 'json' });
  }

  public mapSession(providerSessionId: string, canonicalSessionId?: string): AdapterSession {
    return this.sessionMapper.mapSession(providerSessionId, canonicalSessionId, {
      adapterId: this.id,
      provider: this.metadata.provider,
      protocol: 'MCP',
    });
  }

  public async adaptRequest(input: any): Promise<AgentRequest> {
    const adapterRequest = await this.translateRequest(input);
    return this.protocolTranslator.toCanonicalRequest(adapterRequest);
  }

  public async adaptResponse(response: AgentResponse): Promise<any> {
    const adapterResponse = await this.translateResponse(response);
    return adapterResponse.data;
  }
}
