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

import { AgentCapabilityMapper } from '../core/AgentCapabilityMapper.js';
import { AgentContextMapper } from '../core/AgentContextMapper.js';
import { AgentToolMapper } from '../core/AgentToolMapper.js';
import { AgentSessionMapper } from '../core/AgentSessionMapper.js';
import { AgentProtocolTranslator } from '../core/AgentProtocolTranslator.js';

export class GenericAgentAdapter implements IAgentAdapter {
  public readonly metadata: AdapterMetadata;
  public status: AgentAdapterStatus = 'UNINITIALIZED';

  private readonly capabilityMapper = new AgentCapabilityMapper();
  private readonly contextMapper = new AgentContextMapper();
  private readonly toolMapper = new AgentToolMapper();
  private readonly sessionMapper = new AgentSessionMapper();
  private readonly protocolTranslator = new AgentProtocolTranslator();

  constructor(metadataOverride?: Partial<AdapterMetadata>) {
    this.metadata = {
      adapterId: metadataOverride?.adapterId ?? 'generic_agent_adapter',
      name: metadataOverride?.name ?? 'Generic Agent Reference Adapter',
      adapterVersion: metadataOverride?.adapterVersion ?? '1.0.0',
      protocolVersion: metadataOverride?.protocolVersion ?? '1.0',
      provider: metadataOverride?.provider ?? 'GENERIC',
      protocol: metadataOverride?.protocol ?? 'CANONICAL',
      type: metadataOverride?.type ?? 'REFERENCE',
      status: 'UNINITIALIZED',
      capabilities: metadataOverride?.capabilities ?? [
        'CONTEXT_RETRIEVAL',
        'FEATURE_RETRIEVAL',
        'IMPACT_RETRIEVAL',
        'HISTORY_RETRIEVAL',
        'HEALTH_RETRIEVAL',
        'ARCHITECTURE_RETRIEVAL',
        'CONTEXT_EXPLANATION',
        'CONTEXT_REFRESH',
        'EXECUTION_REPORTING',
        'VERIFICATION_REPORTING',
        'KNOWLEDGE_UPDATE',
        'TASK_STATE',
        'SESSION_STATE',
        'STREAMING',
        'STRUCTURED_OUTPUT',
        'TOOL_CALLING',
        'MCP',
        'BATCH_REQUESTS',
      ],
      supportedAgentType: metadataOverride?.supportedAgentType ?? 'CLI_AGENT',
      limits: metadataOverride?.limits ?? {
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
    return [this.metadata.protocolVersion];
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

    // If already in AdapterRequest shape:
    if (rawRequest.requestId && rawRequest.workspaceContext) {
      return {
        ...rawRequest,
        adapterId: this.id,
        protocol: this.metadata.protocol,
        protocolVersion: rawRequest.protocolVersion ?? this.metadata.protocolVersion,
        agentId: rawRequest.agentId ?? `agent_${this.id}`,
        metadata: {
          ...rawRequest.metadata,
          provider: this.metadata.provider,
          protocol: this.metadata.protocol,
        },
      };
    }

    // If in AgentRequest shape:
    if (rawRequest.requestId && rawRequest.operation) {
      return {
        requestId: rawRequest.requestId,
        adapterId: this.id,
        protocol: this.metadata.protocol,
        protocolVersion: rawRequest.protocolVersion ?? this.metadata.protocolVersion,
        operation: rawRequest.operation,
        agentId: rawRequest.agentId ?? `agent_${this.id}`,
        sessionId: rawRequest.sessionId,
        workspaceContext: rawRequest.workspaceContext ?? {
          workspaceId: 'default',
          repositoryId: 'default',
        },
        payload: rawRequest.payload ?? {},
        timestamp: rawRequest.timestamp ?? new Date().toISOString(),
        metadata: {
          provider: this.metadata.provider,
          protocol: this.metadata.protocol,
        },
      };
    }

    // Generic fallback mapping
    return {
      requestId: rawRequest.id ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      adapterId: this.id,
      protocol: this.metadata.protocol,
      protocolVersion: this.metadata.protocolVersion,
      operation: rawRequest.operation ?? 'GET_CONTEXT',
      agentId: rawRequest.agentId ?? `agent_${this.id}`,
      sessionId: rawRequest.sessionId,
      workspaceContext: rawRequest.workspaceContext ?? {
        workspaceId: rawRequest.workspaceId ?? 'default',
        repositoryId: rawRequest.repositoryId ?? 'default',
      },
      payload: rawRequest.payload ?? rawRequest.input ?? rawRequest,
      timestamp: new Date().toISOString(),
      metadata: {
        provider: this.metadata.provider,
        protocol: this.metadata.protocol,
      },
    };
  }

  public async translateResponse(
    canonicalResponse: AgentResponse,
    requestEnvelope?: AdapterRequest
  ): Promise<AdapterResponse> {
    return this.protocolTranslator.fromCanonicalResponse(canonicalResponse, requestEnvelope);
  }

  public mapTool(tool: AgentTool): unknown {
    return this.toolMapper.mapToolToProviderSchema(tool, this.metadata.provider);
  }

  public mapContext(context: ContextPackage, targetFormat?: string): AdapterContext {
    return this.contextMapper.mapContext(context, targetFormat ? { format: targetFormat } : undefined);
  }

  public mapSession(providerSessionId: string, canonicalSessionId?: string): AdapterSession {
    return this.sessionMapper.mapSession(providerSessionId, canonicalSessionId, {
      adapterId: this.id,
      provider: this.metadata.provider,
      protocol: this.metadata.protocol,
    });
  }

  // Backward compatibility with Phase 7.1 contract
  public async adaptRequest(input: any): Promise<AgentRequest> {
    const adapterRequest = await this.translateRequest(input);
    return this.protocolTranslator.toCanonicalRequest(adapterRequest);
  }

  public async adaptResponse(response: AgentResponse): Promise<any> {
    const adapterResponse = await this.translateResponse(response);
    return adapterResponse.data;
  }
}
