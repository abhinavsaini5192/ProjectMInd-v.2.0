import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateResult } from '../models/KnowledgeUpdateResult.js';
import type { KnowledgeVersion } from '../models/KnowledgeVersion.js';
import type { KnowledgeInvalidation } from '../models/KnowledgeInvalidation.js';
import type { KnowledgeRefreshDecision } from '../models/KnowledgeRefreshDecision.js';

export const KNOWLEDGE_UPDATE_EVENTS = {
  RECEIVED: 'knowledge.update.received',
  PLANNED: 'knowledge.update.planned',
  APPLIED: 'knowledge.update.applied',
  FAILED: 'knowledge.update.failed',
  VERSION_CREATED: 'knowledge.version.created',
  INVALIDATED: 'knowledge.invalidated',
  REFRESH_REQUESTED: 'knowledge.refresh.requested',
} as const;

export interface KnowledgeUpdateReceivedEvent {
  readonly eventName: typeof KNOWLEDGE_UPDATE_EVENTS.RECEIVED;
  readonly update: KnowledgeUpdate;
  readonly timestamp: number;
}

export interface KnowledgeUpdatePlannedEvent {
  readonly eventName: typeof KNOWLEDGE_UPDATE_EVENTS.PLANNED;
  readonly updateId: string;
  readonly plan: KnowledgeUpdatePlan;
  readonly timestamp: number;
}

export interface KnowledgeUpdateAppliedEvent {
  readonly eventName: typeof KNOWLEDGE_UPDATE_EVENTS.APPLIED;
  readonly updateId: string;
  readonly result: KnowledgeUpdateResult;
  readonly timestamp: number;
}

export interface KnowledgeUpdateFailedEvent {
  readonly eventName: typeof KNOWLEDGE_UPDATE_EVENTS.FAILED;
  readonly updateId: string;
  readonly error: string;
  readonly retryEligible: boolean;
  readonly timestamp: number;
}

export interface KnowledgeVersionCreatedEvent {
  readonly eventName: typeof KNOWLEDGE_UPDATE_EVENTS.VERSION_CREATED;
  readonly version: KnowledgeVersion;
  readonly timestamp: number;
}

export interface KnowledgeInvalidatedEvent {
  readonly eventName: typeof KNOWLEDGE_UPDATE_EVENTS.INVALIDATED;
  readonly invalidation: KnowledgeInvalidation;
  readonly timestamp: number;
}

export interface KnowledgeRefreshRequestedEvent {
  readonly eventName: typeof KNOWLEDGE_UPDATE_EVENTS.REFRESH_REQUESTED;
  readonly refreshDecision: KnowledgeRefreshDecision;
  readonly timestamp: number;
}
