import type { ContextRefreshReason } from './ContextRefreshReason.js';

export type ContextDeltaItemType =
  | 'FEATURE'
  | 'RESOURCE'
  | 'SECTION'
  | 'ARCHITECTURE'
  | 'BEHAVIOR'
  | 'HEALTH'
  | 'TEST';

export interface ContextDeltaItem {
  readonly id: string;
  readonly type: ContextDeltaItemType;
  readonly description?: string | undefined;
  readonly data?: unknown | undefined;
}

export interface ContextDelta {
  readonly deltaId: string;
  readonly contextSessionId: string;
  readonly baseContextVersion: number;
  readonly targetContextVersion: number;
  readonly added: readonly ContextDeltaItem[];
  readonly removed: readonly ContextDeltaItem[];
  readonly changed: readonly ContextDeltaItem[];
  readonly stale: readonly ContextDeltaItem[];
  readonly unchanged: readonly ContextDeltaItem[];
  readonly reason: ContextRefreshReason;
  readonly createdAt: Date;
}
