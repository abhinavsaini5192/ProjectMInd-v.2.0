import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import { isObservationSource } from '../models/ObservationSource.js';
import { isObservationType } from '../models/ObservationType.js';
import type {
  IObservationValidator,
  ScopeValidationParams,
} from '../interfaces/IObservationValidator.js';
import {
  ObservationValidationError,
  ObservationScopeError,
} from '../errors/ObservationError.js';
import { ObservationSecurityValidator } from '../security/ObservationSecurityValidator.js';

export class ObservationValidator implements IObservationValidator {
  constructor(private readonly securityValidator?: ObservationSecurityValidator) {}

  public validateRawObservation(raw: unknown, scope?: ScopeValidationParams): void {
    if (!raw || typeof raw !== 'object') {
      throw new ObservationValidationError('Observation must be a valid non-null object');
    }

    const rec = raw as Record<string, unknown>;
    const errors: string[] = [];

    const effectiveWs = rec['workspaceId'] ?? scope?.workspaceId;
    const effectiveRepo = rec['repositoryId'] ?? scope?.repositoryId;

    if (!effectiveWs || typeof effectiveWs !== 'string') {
      errors.push("Missing or invalid 'workspaceId'");
    }
    if (!effectiveRepo || typeof effectiveRepo !== 'string') {
      errors.push("Missing or invalid 'repositoryId'");
    }
    if (rec['source'] && !isObservationSource(rec['source'])) {
      errors.push(`Invalid observation source '${String(rec['source'])}'`);
    }
    if (rec['type'] && !isObservationType(rec['type'])) {
      errors.push(`Invalid observation type '${String(rec['type'])}'`);
    }

    if (errors.length > 0) {
      throw new ObservationValidationError(`Observation validation failed: ${errors.join('; ')}`, errors);
    }

    // Check payload limits and hidden reasoning
    ObservationSecurityValidator.validatePayloadSize(rec['payload'] ?? raw);
    if (rec['metadata'] && typeof rec['metadata'] === 'object') {
      ObservationSecurityValidator.sanitizeHiddenReasoning(rec['metadata'] as Record<string, unknown>, true);
    }
    if (Array.isArray(rec['affectedResources'])) {
      for (const res of rec['affectedResources']) {
        if (typeof res === 'string') {
          ObservationSecurityValidator.sanitizeResourcePath(res);
        }
      }
    }

    // Validate scope if provided
    if (scope) {
      if (scope.workspaceId && rec['workspaceId'] && rec['workspaceId'] !== scope.workspaceId) {
        throw new ObservationScopeError(
          `Observation workspace '${rec['workspaceId']}' does not match context workspace '${scope.workspaceId}'`
        );
      }
      if (scope.repositoryId && rec['repositoryId'] && rec['repositoryId'] !== scope.repositoryId) {
        throw new ObservationScopeError(
          `Observation repository '${rec['repositoryId']}' does not match context repository '${scope.repositoryId}'`
        );
      }
      if (scope.taskId && rec['taskId'] && rec['taskId'] !== scope.taskId) {
        throw new ObservationScopeError(
          `Observation task '${rec['taskId']}' does not match context task '${scope.taskId}'`
        );
      }
    }
  }

  public validateObservation(
    observation: ExecutionObservation,
    scope?: ScopeValidationParams
  ): void {
    if (!observation || typeof observation !== 'object') {
      throw new ObservationValidationError('Observation must be a valid non-null object');
    }

    const errors: string[] = [];

    if (!observation.observationId || typeof observation.observationId !== 'string') {
      errors.push("Missing or invalid 'observationId'");
    }
    if (!observation.workspaceId || typeof observation.workspaceId !== 'string') {
      errors.push("Missing or invalid 'workspaceId'");
    }
    if (!observation.repositoryId || typeof observation.repositoryId !== 'string') {
      errors.push("Missing or invalid 'repositoryId'");
    }
    if (!isObservationSource(observation.source)) {
      errors.push(`Invalid source '${observation.source}'`);
    }
    if (!isObservationType(observation.type)) {
      errors.push(`Invalid type '${observation.type}'`);
    }
    if (!observation.timestamp || isNaN(Date.parse(observation.timestamp))) {
      errors.push(`Invalid timestamp format '${observation.timestamp}'`);
    }

    if (errors.length > 0) {
      throw new ObservationValidationError(`Invalid observation structure: ${errors.join('; ')}`, errors);
    }

    // Enforce payload limit
    if (observation.payload) {
      ObservationSecurityValidator.validatePayloadSize(observation.payload);
    }
    // Enforce resource path security
    if (observation.affectedResources) {
      for (const res of observation.affectedResources) {
        ObservationSecurityValidator.sanitizeResourcePath(res);
      }
    }
    // Enforce no hidden reasoning
    if (observation.payload && typeof observation.payload === 'object') {
      ObservationSecurityValidator.sanitizeHiddenReasoning(
        observation.payload as Record<string, unknown>,
        true
      );
    }

    this.validateScope(observation, scope);
  }

  public validateScope(
    observation: ExecutionObservation,
    scope?: ScopeValidationParams | string,
    repositoryId?: string
  ): void {
    if (!scope) return;

    const scopeObj: ScopeValidationParams =
      typeof scope === 'string'
        ? { workspaceId: scope, repositoryId }
        : scope;

    if (scopeObj.workspaceId && observation.workspaceId !== scopeObj.workspaceId) {
      throw new ObservationScopeError(
        `Cross-workspace observation rejected: '${observation.workspaceId}' vs '${scopeObj.workspaceId}'`
      );
    }

    if (scopeObj.repositoryId && observation.repositoryId !== scopeObj.repositoryId) {
      throw new ObservationScopeError(
        `Cross-repository observation rejected: '${observation.repositoryId}' vs '${scopeObj.repositoryId}'`
      );
    }

    if (scopeObj.taskId && observation.taskId && observation.taskId !== scopeObj.taskId) {
      throw new ObservationScopeError(
        `Cross-task observation rejected: '${observation.taskId}' vs '${scopeObj.taskId}'`
      );
    }

    if (
      scopeObj.agentSessionId &&
      observation.agentSessionId &&
      observation.agentSessionId !== scopeObj.agentSessionId
    ) {
      throw new ObservationScopeError(
        `Cross-session observation rejected: '${observation.agentSessionId}' vs '${scopeObj.agentSessionId}'`
      );
    }
  }
}
