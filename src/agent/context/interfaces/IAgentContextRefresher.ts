import type { ContextPackage } from '../../../context/models/ContextPackage.js';
import type { AgentContextSession } from '../models/AgentContextSession.js';
import type { AgentContextState } from '../models/AgentContextState.js';
import type { ContextRefreshReason } from '../models/ContextRefreshReason.js';
import type { ContextPreferences } from '../models/ContextPreferences.js';

export interface RefreshContextOptions {
  readonly reason?: ContextRefreshReason | undefined;
  readonly modifiedFiles?: readonly string[] | undefined;
  readonly affectedFeatures?: readonly string[] | undefined;
  readonly staleSections?: readonly string[] | undefined;
  readonly preferences?: ContextPreferences | undefined;
  readonly tokenBudget?: number | undefined;
  readonly forceFullRefresh?: boolean | undefined;
}

export interface RefreshContextResult {
  readonly package: ContextPackage;
  readonly refreshedVersion: number;
  readonly previousVersion: number;
  readonly reason: ContextRefreshReason;
  readonly reusedSections: readonly string[];
  readonly rebuiltSections: readonly string[];
  readonly affectedFeatures: readonly string[];
  readonly durationMs: number;
}

export interface IAgentContextRefresher {
  refreshContext(
    session: AgentContextSession,
    state: AgentContextState,
    currentPackage: ContextPackage,
    options: RefreshContextOptions,
    pinnedFeatureIds?: readonly string[] | undefined,
    pinnedResourceIds?: readonly string[] | undefined
  ): Promise<RefreshContextResult>;
}
