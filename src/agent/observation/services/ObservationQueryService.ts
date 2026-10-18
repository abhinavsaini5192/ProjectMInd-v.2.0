import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationConflict } from '../models/ObservationConflict.js';
import type { ObservationTimeline } from '../models/ObservationTimeline.js';
import type { ExecutionObservationSummary } from '../models/ExecutionObservationSummary.js';
import type {
  IObservationQueryService,
  PaginatedObservations,
} from '../interfaces/IObservationQueryService.js';
import type {
  IObservationStore,
  ObservationQueryFilter,
} from '../interfaces/IObservationStore.js';
import type { ScopeValidationParams } from '../interfaces/IObservationValidator.js';
import type { ObservationType } from '../models/ObservationType.js';
import type { ObservationSource } from '../models/ObservationSource.js';
import { ObservationValidator } from '../validators/ObservationValidator.js';
import { ObservationTimelineBuilder } from './ObservationTimelineBuilder.js';
import { ObservationSummaryGenerator } from './ObservationSummaryGenerator.js';

export class ObservationQueryService implements IObservationQueryService {
  private readonly timelineBuilder: ObservationTimelineBuilder;
  private readonly summaryGenerator: ObservationSummaryGenerator;

  constructor(
    private readonly store: IObservationStore,
    private readonly validator: ObservationValidator = new ObservationValidator()
  ) {
    this.timelineBuilder = new ObservationTimelineBuilder(store);
    this.summaryGenerator = new ObservationSummaryGenerator(store);
  }

  public async getObservation(
    observationId: string,
    scope?: ScopeValidationParams
  ): Promise<ExecutionObservation | undefined> {
    const obs = await this.store.getObservation(observationId);
    if (!obs) return undefined;
    if (scope) {
      this.validator.validateScope(obs, scope);
    }
    return obs;
  }

  public async getObservations(
    filter: ObservationQueryFilter,
    scope?: ScopeValidationParams
  ): Promise<PaginatedObservations> {
    const effectiveFilter: ObservationQueryFilter = {
      ...filter,
      workspaceId: scope?.workspaceId ?? filter.workspaceId,
      repositoryId: scope?.repositoryId ?? filter.repositoryId,
      agentSessionId: scope?.agentSessionId ?? filter.agentSessionId,
      taskId: scope?.taskId ?? filter.taskId,
      resourcePath: filter.resourcePath ?? (filter as any).affectedResource,
      limit: Math.min(filter.limit ?? 50, 100),
      offset: filter.offset ?? 0,
    };

    const observations = await this.store.listObservations(effectiveFilter);
    const totalCount = await this.store.countObservations(effectiveFilter);

    return {
      observations,
      totalCount,
      totalObservations: totalCount,
      limit: effectiveFilter.limit!,
      offset: effectiveFilter.offset!,
      hasMore: effectiveFilter.offset! + observations.length < totalCount,
    };
  }

  public async getTaskObservations(
    taskId: string,
    scope: ScopeValidationParams
  ): Promise<readonly ExecutionObservation[]> {
    return this.store.listObservations({
      workspaceId: scope.workspaceId ?? '',
      repositoryId: scope.repositoryId ?? '',
      taskId,
      limit: 1000,
    });
  }

  public async getSessionObservations(
    sessionId: string,
    scope: ScopeValidationParams
  ): Promise<readonly ExecutionObservation[]> {
    return this.store.listObservations({
      workspaceId: scope.workspaceId ?? '',
      repositoryId: scope.repositoryId ?? '',
      agentSessionId: sessionId,
      limit: 1000,
    });
  }

  public async getResourceObservations(
    resourcePath: string,
    scope: ScopeValidationParams
  ): Promise<readonly ExecutionObservation[]> {
    return this.store.listObservations({
      workspaceId: scope.workspaceId ?? '',
      repositoryId: scope.repositoryId ?? '',
      resourcePath,
      limit: 1000,
    });
  }

  public async getObservationsByType(
    type: ObservationType,
    scope: ScopeValidationParams
  ): Promise<readonly ExecutionObservation[]> {
    return this.store.listObservations({
      workspaceId: scope.workspaceId ?? '',
      repositoryId: scope.repositoryId ?? '',
      type,
      limit: 1000,
    });
  }

  public async getObservationsBySource(
    source: ObservationSource,
    scope: ScopeValidationParams
  ): Promise<readonly ExecutionObservation[]> {
    return this.store.listObservations({
      workspaceId: scope.workspaceId ?? '',
      repositoryId: scope.repositoryId ?? '',
      source,
      limit: 1000,
    });
  }

  public async getObservationTimeline(
    taskId: string,
    scope?: ScopeValidationParams
  ): Promise<ObservationTimeline> {
    return this.timelineBuilder.buildTimeline(taskId);
  }

  public readonly getTaskTimeline = this.getObservationTimeline.bind(this);

  public async getConflicts(
    taskId: string,
    scope?: ScopeValidationParams
  ): Promise<readonly ObservationConflict[]> {
    return this.store.listConflicts(taskId);
  }

  public async getObservationConflicts(
    filter: { taskId?: string },
    scope?: ScopeValidationParams
  ): Promise<{ conflicts: readonly ObservationConflict[]; totalConflicts: number }> {
    const taskId = filter.taskId ?? scope?.taskId ?? '';
    const conflicts = await this.store.listConflicts(taskId);
    return {
      conflicts,
      totalConflicts: conflicts.length,
    };
  }

  public async getExecutionSummary(
    taskId: string,
    scope?: ScopeValidationParams
  ): Promise<ExecutionObservationSummary> {
    return this.summaryGenerator.generateSummary(
      taskId,
      scope?.workspaceId ?? '',
      scope?.repositoryId ?? ''
    );
  }
}
