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

export class GenericCliAdapter implements IAgentAdapter {
  public readonly metadata: AdapterMetadata;
  public status: AgentAdapterStatus = 'UNINITIALIZED';

  private readonly capabilityMapper = new AgentCapabilityMapper();
  private readonly contextMapper = new AgentContextMapper();
  private readonly toolMapper = new AgentToolMapper();
  private readonly sessionMapper = new AgentSessionMapper();
  private readonly protocolTranslator = new AgentProtocolTranslator();

  constructor(metadataOverride?: Partial<AdapterMetadata>) {
    this.metadata = {
      adapterId: metadataOverride?.adapterId ?? 'cli_agent_adapter',
      name: metadataOverride?.name ?? 'CLI Agent Adapter',
      adapterVersion: metadataOverride?.adapterVersion ?? '1.0.0',
      protocolVersion: metadataOverride?.protocolVersion ?? '1.0',
      provider: metadataOverride?.provider ?? 'GENERIC',
      protocol: 'CLI',
      type: 'CLI',
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
        'STRUCTURED_OUTPUT',
      ],
      supportedAgentType: 'CLI_AGENT',
      limits: metadataOverride?.limits ?? {
        maxRequestSizeBytes: 5 * 1024 * 1024,
        maxResponseSizeBytes: 5 * 1024 * 1024,
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
    return 'CLI_AGENT';
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

    // CLI text prompt input e.g. { prompt: '...', workspaceId: '...', repositoryId: '...' }
    if (typeof rawRequest === 'string') {
      return {
        requestId: `cli_${Date.now()}`,
        adapterId: this.id,
        protocol: 'CLI',
        protocolVersion: this.metadata.protocolVersion,
        operation: 'GET_CONTEXT',
        agentId: `agent_${this.id}`,
        workspaceContext: {
          workspaceId: 'cli_ws',
          repositoryId: 'cli_repo',
        },
        payload: { taskText: rawRequest },
        timestamp: new Date().toISOString(),
        metadata: {
          provider: this.metadata.provider,
          protocol: 'CLI',
        },
      };
    }

    const taskText = rawRequest.prompt ?? rawRequest.task ?? rawRequest.query ?? rawRequest.input;
    const workspaceId = rawRequest.workspaceId ?? rawRequest.workspaceContext?.workspaceId ?? 'cli_ws';
    const repositoryId = rawRequest.repositoryId ?? rawRequest.workspaceContext?.repositoryId ?? 'cli_repo';

    return {
      requestId: String(rawRequest.id ?? rawRequest.requestId ?? `cli_${Date.now()}`),
      adapterId: this.id,
      protocol: 'CLI',
      protocolVersion: rawRequest.protocolVersion ?? this.metadata.protocolVersion,
      operation: rawRequest.operation ?? 'GET_CONTEXT',
      agentId: rawRequest.agentId ?? `agent_${this.id}`,
      sessionId: rawRequest.sessionId,
      workspaceContext: {
        workspaceId,
        repositoryId,
      },
      payload: {
        taskText,
        ...rawRequest.payload,
        ...rawRequest.options,
      },
      timestamp: rawRequest.timestamp ?? new Date().toISOString(),
      metadata: {
        provider: this.metadata.provider,
        protocol: 'CLI',
      },
    };
  }

  public async translateResponse(
    canonicalResponse: AgentResponse,
    requestEnvelope?: AdapterRequest
  ): Promise<AdapterResponse> {
    const isError = canonicalResponse.status === 'ERROR';
    const durationMs = canonicalResponse.metadata?.durationMs ?? 0;

    let outputText = '';
    if (isError) {
      outputText = `[ERROR] ${canonicalResponse.error?.code}: ${canonicalResponse.error?.message}`;
    } else if (typeof canonicalResponse.data === 'string') {
      outputText = canonicalResponse.data;
    } else if (canonicalResponse.data && typeof canonicalResponse.data === 'object') {
      const dataObj = canonicalResponse.data as any;
      if (dataObj.content) {
        outputText = dataObj.content;
      } else if (dataObj.compiledPromptText) {
        outputText = dataObj.compiledPromptText;
      } else {
        outputText = JSON.stringify(dataObj, null, 2);
      }
    }

    return {
      requestId: canonicalResponse.requestId,
      adapterId: this.id,
      status: canonicalResponse.status,
      data: {
        text: outputText,
        raw: canonicalResponse.data,
      },
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
        durationMs,
        timestamp: new Date().toISOString(),
      },
    };
  }

  public mapTool(tool: AgentTool): unknown {
    return this.toolMapper.mapToolToProviderSchema(tool, 'GENERIC');
  }

  public mapContext(context: ContextPackage, targetFormat: string = 'markdown'): AdapterContext {
    return this.contextMapper.mapContext(context, { format: targetFormat });
  }

  public mapSession(providerSessionId: string, canonicalSessionId?: string): AdapterSession {
    return this.sessionMapper.mapSession(providerSessionId, canonicalSessionId, {
      adapterId: this.id,
      provider: this.metadata.provider,
      protocol: 'CLI',
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
