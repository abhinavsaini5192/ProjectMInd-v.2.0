import type {
  GetCurrentContextOptions,
  GetCurrentContextResult,
  ScopeValidationParams,
  IAgentContextSessionManager,
} from '../../context/interfaces/IAgentContextSessionManager.js';
import type {
  RefreshContextOptions,
  RefreshContextResult,
} from '../../context/interfaces/IAgentContextRefresher.js';
import type { ContextRefreshReason } from '../../context/models/ContextRefreshReason.js';
import type { ContextRefreshPolicy } from '../models/AgentRuntimeConfig.js';
import type { IAgentContextCoordinator } from '../interfaces/IAgentContextCoordinator.js';
import type { IAgentRuntimeTelemetry } from '../interfaces/IAgentRuntimeTelemetry.js';

export class AgentContextCoordinator implements IAgentContextCoordinator {
  constructor(
    private readonly contextSessionManager: IAgentContextSessionManager,
    private readonly refreshPolicy: ContextRefreshPolicy = 'ON_NEXT_REQUEST',
    private readonly telemetry?: IAgentRuntimeTelemetry | undefined
  ) {}

  public async getContext(
    contextSessionId: string,
    options?: GetCurrentContextOptions,
    scope?: ScopeValidationParams
  ): Promise<GetCurrentContextResult> {
    const shouldAutoRefresh =
      options?.autoRefreshIfStale !== undefined
        ? options.autoRefreshIfStale
        : this.refreshPolicy === 'IMMEDIATE' || this.refreshPolicy === 'ON_NEXT_REQUEST';

    const mergedOptions: GetCurrentContextOptions = {
      ...options,
      autoRefreshIfStale: shouldAutoRefresh,
    };

    const startTime = Date.now();
    const result = await this.contextSessionManager.getCurrentContext(contextSessionId, mergedOptions, scope);
    const durationMs = Date.now() - startTime;

    if (result.wasRefreshed) {
      this.telemetry?.recordContextRefresh(durationMs);
    }

    return result;
  }

  public async refreshContext(
    contextSessionId: string,
    options?: RefreshContextOptions,
    scope?: ScopeValidationParams
  ): Promise<RefreshContextResult> {
    const startTime = Date.now();
    const result = await this.contextSessionManager.refreshContextSession(contextSessionId, options, scope);
    const durationMs = Date.now() - startTime;

    this.telemetry?.recordContextRefresh(durationMs);
    return result;
  }

  public async markContextStale(
    contextSessionId: string,
    reason: ContextRefreshReason,
    scope?: ScopeValidationParams
  ): Promise<void> {
    await this.contextSessionManager.markContextStale(contextSessionId, reason, scope);

    if (this.refreshPolicy === 'IMMEDIATE') {
      try {
        await this.refreshContext(contextSessionId, undefined, scope);
      } catch {
        // If immediate refresh fails, the session remains stale for the next request
      }
    }
  }
}
