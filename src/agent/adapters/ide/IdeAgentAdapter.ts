import type { IIdeAgentAdapter, IdeEditorState } from './IIdeAgentAdapter.js';
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

export class IdeAgentAdapter implements IIdeAgentAdapter {
  public readonly metadata: AdapterMetadata;
  public status: AgentAdapterStatus = 'UNINITIALIZED';

  private activeEditorState?: IdeEditorState | undefined;
  private readonly capabilityMapper = new AgentCapabilityMapper();
  private readonly contextMapper = new AgentContextMapper();
  private readonly toolMapper = new AgentToolMapper();
  private readonly sessionMapper = new AgentSessionMapper();
  private readonly protocolTranslator = new AgentProtocolTranslator();

  constructor(metadataOverride?: Partial<AdapterMetadata>) {
    this.metadata = {
      adapterId: metadataOverride?.adapterId ?? 'ide_agent_adapter',
      name: metadataOverride?.name ?? 'IDE Agent Adapter',
      adapterVersion: metadataOverride?.adapterVersion ?? '1.0.0',
      protocolVersion: metadataOverride?.protocolVersion ?? '1.0',
      provider: metadataOverride?.provider ?? 'GENERIC',
      protocol: 'IDE',
      type: 'IDE',
      status: 'UNINITIALIZED',
      capabilities: metadataOverride?.capabilities ?? [
        'CONTEXT_RETRIEVAL',
        'FEATURE_RETRIEVAL',
        'IMPACT_RETRIEVAL',
        'HISTORY_RETRIEVAL',
        'HEALTH_RETRIEVAL',
        'ARCHITECTURE_RETRIEVAL',
        'CONTEXT_REFRESH',
        'EXECUTION_REPORTING',
        'VERIFICATION_REPORTING',
        'TASK_STATE',
        'SESSION_STATE',
        'STREAMING',
        'STRUCTURED_OUTPUT',
      ],
      supportedAgentType: 'IDE_AGENT',
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

  public get targetAgentType(): AgentType {
    return 'IDE_AGENT';
  }

  public get supportedProtocolVersions(): readonly string[] {
    return [this.metadata.protocolVersion];
  }

  public getActiveEditorState(): IdeEditorState | undefined {
    return this.activeEditorState;
  }

  public setActiveEditorState(state: IdeEditorState): void {
    this.activeEditorState = state;
  }

  public async initialize(): Promise<void> {
    this.status = 'INITIALIZING';
    this.status = 'READY';
  }

  public async shutdown(): Promise<void> {
    this.status = 'SHUTTING_DOWN';
    this.sessionMapper.clear();
    this.activeEditorState = undefined;
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

    const workspaceId = rawRequest.workspaceId ?? rawRequest.workspaceContext?.workspaceId ?? 'ide_ws';
    const repositoryId = rawRequest.repositoryId ?? rawRequest.workspaceContext?.repositoryId ?? 'ide_repo';

    return {
      requestId: String(rawRequest.id ?? rawRequest.requestId ?? `ide_${Date.now()}`),
      adapterId: this.id,
      protocol: 'IDE',
      protocolVersion: rawRequest.protocolVersion ?? this.metadata.protocolVersion,
      operation: rawRequest.operation ?? 'GET_CONTEXT',
      agentId: rawRequest.agentId ?? `agent_${this.id}`,
      sessionId: rawRequest.sessionId,
      workspaceContext: {
        workspaceId,
        repositoryId,
      },
      payload: {
        ...rawRequest.payload,
        editorState: this.activeEditorState ?? rawRequest.editorState,
      },
      timestamp: rawRequest.timestamp ?? new Date().toISOString(),
      metadata: {
        provider: this.metadata.provider,
        protocol: 'IDE',
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
    return this.toolMapper.mapToolToProviderSchema(tool, 'CURSOR');
  }

  public mapContext(context: ContextPackage, targetFormat: string = 'json'): AdapterContext {
    return this.contextMapper.mapContext(context, { format: targetFormat });
  }

  public mapSession(providerSessionId: string, canonicalSessionId?: string): AdapterSession {
    return this.sessionMapper.mapSession(providerSessionId, canonicalSessionId, {
      adapterId: this.id,
      provider: this.metadata.provider,
      protocol: 'IDE',
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
