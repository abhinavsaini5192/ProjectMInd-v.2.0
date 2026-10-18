import type { IAgentProtocolTranslator } from '../interfaces/IAgentProtocolTranslator.js';
import type { AdapterRequest } from '../models/AdapterRequest.js';
import type { AdapterResponse } from '../models/AdapterResponse.js';
import type { AgentRequest } from '../../models/AgentRequest.js';
import type { AgentResponse } from '../../models/AgentResponse.js';
import type { AgentOperationType } from '../../models/AgentOperation.js';
import { AdapterTranslationError } from '../errors/AgentAdapterError.js';

export class AgentProtocolTranslator implements IAgentProtocolTranslator {
  public toCanonicalRequest(adapterRequest: AdapterRequest): AgentRequest {
    if (!adapterRequest) {
      throw new AdapterTranslationError('unknown', 'AdapterRequest cannot be null or undefined');
    }

    if (!adapterRequest.workspaceContext?.workspaceId || !adapterRequest.workspaceContext?.repositoryId) {
      throw new AdapterTranslationError(
        adapterRequest.adapterId,
        'AdapterRequest missing required workspaceContext (workspaceId and repositoryId are required)'
      );
    }

    return {
      requestId: adapterRequest.requestId,
      protocolVersion: adapterRequest.protocolVersion,
      operation: adapterRequest.operation as AgentOperationType,
      agentId: adapterRequest.agentId ?? `adapter_${adapterRequest.adapterId}`,
      sessionId: adapterRequest.sessionId,
      workspaceContext: {
        workspaceId: adapterRequest.workspaceContext.workspaceId,
        repositoryId: adapterRequest.workspaceContext.repositoryId,
      },
      payload: adapterRequest.payload,
      timestamp: adapterRequest.timestamp,
      traceId: adapterRequest.traceId,
      clientInfo: adapterRequest.clientInfo,
    };
  }

  public fromCanonicalResponse(
    canonicalResponse: AgentResponse,
    originalRequest?: AdapterRequest
  ): AdapterResponse {
    if (!canonicalResponse) {
      throw new AdapterTranslationError(
        originalRequest?.adapterId ?? 'unknown',
        'Canonical AgentResponse cannot be null or undefined'
      );
    }

    const adapterId = originalRequest?.adapterId ?? 'unknown';
    const durationMs = canonicalResponse.metadata?.durationMs ?? 0;

    return {
      requestId: canonicalResponse.requestId,
      adapterId,
      status: canonicalResponse.status,
      data: canonicalResponse.data,
      error: canonicalResponse.error
        ? {
            code: canonicalResponse.error.code,
            message: canonicalResponse.error.message,
            retryable: false,
            severity: 'ERROR',
            details: canonicalResponse.error.details,
          }
        : undefined,
      warnings: [],
      metadata: {
        durationMs,
        timestamp: new Date().toISOString(),
        protocolVersion: canonicalResponse.metadata?.protocolVersion ?? '1.0',
        adapterVersion: '1.0.0',
        traceId: canonicalResponse.metadata?.traceId,
        tokensUsed: canonicalResponse.metadata?.tokensUsed,
      },
    };
  }
}
