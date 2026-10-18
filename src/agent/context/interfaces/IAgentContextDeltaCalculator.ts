import type { ContextPackage } from '../../../context/models/ContextPackage.js';
import type { ContextDelta } from '../models/ContextDelta.js';
import type { ContextRefreshReason } from '../models/ContextRefreshReason.js';

export interface IAgentContextDeltaCalculator {
  computeDelta(
    previousPackage: ContextPackage,
    nextPackage: ContextPackage,
    reason: ContextRefreshReason,
    contextSessionId: string,
    baseVersion: number,
    targetVersion: number
  ): ContextDelta;

  validateDeltaSafety(
    delta: ContextDelta,
    currentVersion: number,
    repositoryId: string,
    expectedRepositoryId: string
  ): void;
}
