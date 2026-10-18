import type { IAgentAdapter } from '../interfaces/IAgentAdapter.js';
import type { IAgentAdapterRegistry } from '../interfaces/IAgentAdapterRegistry.js';
import type { IAgentAdapterResolver, AdapterResolutionCriteria } from '../interfaces/IAgentAdapterResolver.js';
import type { IAgentAdapterValidator } from '../interfaces/IAgentAdapterValidator.js';
import type { IAgentProtocolTranslator } from '../interfaces/IAgentProtocolTranslator.js';
import type { IAgentAdapterManager } from '../interfaces/IAgentAdapterManager.js';
import type { AdapterResponse } from '../models/AdapterResponse.js';
import type { IAdapterEventPublisher } from './AgentAdapterRegistry.js';
import { AgentAdapterRegistry } from './AgentAdapterRegistry.js';
import { AgentAdapterResolver } from './AgentAdapterResolver.js';
import { AgentAdapterValidator } from './AgentAdapterValidator.js';
import { AgentProtocolTranslator } from './AgentProtocolTranslator.js';
import { AGENT_ADAPTER_EVENTS } from '../events/AgentAdapterEvents.js';

export class AgentAdapterManager implements IAgentAdapterManager {
  public readonly registry: IAgentAdapterRegistry;
  public readonly resolver: IAgentAdapterResolver;
  private readonly validator: IAgentAdapterValidator;
  private readonly protocolTranslator: IAgentProtocolTranslator;

  constructor(
    registry?: IAgentAdapterRegistry,
    resolver?: IAgentAdapterResolver,
    validator?: IAgentAdapterValidator,
    protocolTranslator?: IAgentProtocolTranslator,
    private readonly eventPublisher?: IAdapterEventPublisher | undefined
  ) {
    this.registry = registry ?? new AgentAdapterRegistry(eventPublisher);
    this.resolver = resolver ?? new AgentAdapterResolver(this.registry, undefined, eventPublisher);
    this.validator = validator ?? new AgentAdapterValidator();
    this.protocolTranslator = protocolTranslator ?? new AgentProtocolTranslator();
  }

  public async registerAdapter(adapter: IAgentAdapter): Promise<void> {
    this.validator.validateAdapter(adapter.metadata);
    await adapter.initialize();
    this.registry.register(adapter);
  }

  public async unregisterAdapter(adapterId: string): Promise<boolean> {
    const adapter = this.registry.get(adapterId);
    if (adapter) {
      try {
        await adapter.shutdown();
      } catch (err) {
        // Log or preserve fail-isolation
      }
      return this.registry.unregister(adapterId);
    }
    return false;
  }

  public getAdapter(adapterId: string): IAgentAdapter | undefined {
    return this.registry.get(adapterId);
  }

  public resolveAdapter(criteria: AdapterResolutionCriteria): IAgentAdapter {
    return this.resolver.resolve(criteria);
  }

  public async processRequest(
    criteria: AdapterResolutionCriteria,
    rawRequest: unknown
  ): Promise<AdapterResponse> {
    const startTime = Date.now();
    let adapter: IAgentAdapter | undefined;
    let requestId = 'unknown';

    try {
      adapter = this.resolver.resolve(criteria);

      // Translate provider request to normalized AdapterRequest
      const adapterRequest = await adapter.translateRequest(rawRequest);
      requestId = adapterRequest.requestId;

      // Validate normalized request
      this.validator.validateRequest(adapterRequest);

      if (this.eventPublisher) {
        this.eventPublisher.publish(AGENT_ADAPTER_EVENTS.REQUEST_TRANSLATED, {
          eventName: AGENT_ADAPTER_EVENTS.REQUEST_TRANSLATED,
          adapterId: adapter.id,
          requestId,
          operation: adapterRequest.operation,
          workspaceId: adapterRequest.workspaceContext.workspaceId,
          repositoryId: adapterRequest.workspaceContext.repositoryId,
          timestamp: Date.now(),
        });
      }

      // Return translated request inside response data envelope (dispatch to canonical happens via AgentPipeline)
      const durationMs = Date.now() - startTime;
      const response: AdapterResponse = {
        requestId,
        adapterId: adapter.id,
        status: 'SUCCESS',
        data: adapterRequest,
        warnings: [],
        metadata: {
          durationMs,
          timestamp: new Date().toISOString(),
          protocolVersion: adapter.metadata.protocolVersion,
          adapterVersion: adapter.metadata.adapterVersion,
        },
      };

      if (this.eventPublisher) {
        this.eventPublisher.publish(AGENT_ADAPTER_EVENTS.RESPONSE_TRANSLATED, {
          eventName: AGENT_ADAPTER_EVENTS.RESPONSE_TRANSLATED,
          adapterId: adapter.id,
          requestId,
          status: 'SUCCESS',
          durationMs,
          timestamp: Date.now(),
        });
      }

      return response;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorPayload = {
        code: err?.code ?? 'ADAPTER_PROCESSING_ERROR',
        message: err?.message ?? String(err),
        retryable: false,
        severity: 'ERROR' as const,
      };

      if (this.eventPublisher) {
        this.eventPublisher.publish(AGENT_ADAPTER_EVENTS.ERROR_OCCURRED, {
          eventName: AGENT_ADAPTER_EVENTS.ERROR_OCCURRED,
          adapterId: adapter?.id ?? 'unknown',
          requestId,
          error: errorPayload,
          timestamp: Date.now(),
        });
      }

      return {
        requestId,
        adapterId: adapter?.id ?? 'unknown',
        status: 'ERROR',
        error: errorPayload,
        warnings: [],
        metadata: {
          durationMs,
          timestamp: new Date().toISOString(),
          protocolVersion: adapter?.metadata?.protocolVersion ?? '1.0',
          adapterVersion: adapter?.metadata?.adapterVersion ?? '1.0.0',
        },
      };
    }
  }

  public async shutdownAll(): Promise<void> {
    const adapters = this.registry.list();
    await Promise.all(
      adapters.map(async (adapter) => {
        try {
          await adapter.shutdown();
        } catch {
          // Fail-safe cleanup
        }
      })
    );
    this.registry.clear();
  }
}
