import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationConflict } from '../models/ObservationConflict.js';
import type { ObservationTimeline } from '../models/ObservationTimeline.js';
import type { ExecutionObservationSummary } from '../models/ExecutionObservationSummary.js';
import type { ObservationQueryFilter } from './IObservationStore.js';
import type { ScopeValidationParams } from './IObservationValidator.js';
import type { ObservationType } from '../models/ObservationType.js';
import type { ObservationSource } from '../models/ObservationSource.js';

export interface PaginatedObservations {
  readonly observations: readonly ExecutionObservation[];
  readonly totalCount: number;
  readonly totalObservations: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

export interface IObservationQueryService {
  getObservation(observationId: string, scope?: ScopeValidationParams): Promise<ExecutionObservation | undefined>;
  getObservations(filter: ObservationQueryFilter, scope?: ScopeValidationParams): Promise<PaginatedObservations>;
  getTaskObservations(taskId: string, scope?: ScopeValidationParams): Promise<readonly ExecutionObservation[]>;
  getSessionObservations(sessionId: string, scope?: ScopeValidationParams): Promise<readonly ExecutionObservation[]>;
  getResourceObservations(resourcePath: string, scope?: ScopeValidationParams): Promise<readonly ExecutionObservation[]>;
  getObservationsByType(type: ObservationType, scope?: ScopeValidationParams): Promise<readonly ExecutionObservation[]>;
  getObservationsBySource(source: ObservationSource, scope?: ScopeValidationParams): Promise<readonly ExecutionObservation[]>;
  getObservationTimeline(taskId: string, scope?: ScopeValidationParams): Promise<ObservationTimeline>;
  getTaskTimeline(taskId: string, scope?: ScopeValidationParams): Promise<ObservationTimeline>;
  getConflicts(taskId: string, scope?: ScopeValidationParams): Promise<readonly ObservationConflict[]>;
  getObservationConflicts(filter: { taskId?: string }, scope?: ScopeValidationParams): Promise<{ conflicts: readonly ObservationConflict[]; totalConflicts: number }>;
  getExecutionSummary(taskId: string, scope?: ScopeValidationParams): Promise<ExecutionObservationSummary>;
}
