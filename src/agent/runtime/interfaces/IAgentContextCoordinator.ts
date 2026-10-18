import type {
  GetCurrentContextOptions,
  GetCurrentContextResult,
  ScopeValidationParams
} from '../../context/interfaces/IAgentContextSessionManager.js';
import type {
  RefreshContextOptions,
  RefreshContextResult
} from '../../context/interfaces/IAgentContextRefresher.js';
import type { ContextRefreshReason } from '../../context/models/ContextRefreshReason.js';

export interface IAgentContextCoordinator {
  getContext(
    contextSessionId: string,
    options?: GetCurrentContextOptions,
    scope?: ScopeValidationParams
  ): Promise<GetCurrentContextResult>;

  refreshContext(
    contextSessionId: string,
    options?: RefreshContextOptions,
    scope?: ScopeValidationParams
  ): Promise<RefreshContextResult>;

  markContextStale(
    contextSessionId: string,
    reason: ContextRefreshReason,
    scope?: ScopeValidationParams
  ): Promise<void>;
}
