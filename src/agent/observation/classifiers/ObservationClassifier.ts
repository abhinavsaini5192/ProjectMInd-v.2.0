import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationType } from '../models/ObservationType.js';
import type {
  IObservationClassifier,
  ObservationClassificationResult,
} from '../interfaces/IObservationClassifier.js';
import { DEFAULT_OBSERVATION_KNOWLEDGE_POLICY } from '../models/ObservationKnowledgePolicy.js';

export class ObservationClassifier implements IObservationClassifier {
  public classify(observation: ExecutionObservation): ObservationClassificationResult {
    const type = observation.type;
    const category = this.determineCategory(type);
    const affectedResources = this.extractAffectedResources(observation);
    const affectedTaskState = this.classifyTargetTaskState(observation);

    const rule = DEFAULT_OBSERVATION_KNOWLEDGE_POLICY.rules[type];
    const isProjectRelevant = rule ? rule.isProjectRelevant : false;
    const triggersContextInvalidation = rule ? rule.triggersContextInvalidation : false;

    return {
      type,
      category,
      affectedResources,
      affectedTaskState,
      isProjectRelevant,
      triggersContextInvalidation,
    };
  }

  public classifyCategory(type: ObservationType): string {
    return this.determineCategory(type);
  }

  public classifyTargetTaskState(observation: ExecutionObservation): string | undefined {
    if (observation.type === 'BLOCKER_ENCOUNTERED') return 'BLOCKED';
    if (observation.type === 'VERIFICATION_PASSED') return 'VERIFIED';
    return this.determineAffectedTaskState(observation.type);
  }

  public determineCategory(type: ObservationType): string {
    if (type === 'BLOCKER_ENCOUNTERED' || type.startsWith('TASK_')) return 'TASK';
    if (type.startsWith('FILE_')) return 'FILE';
    if (type.startsWith('SYMBOL_')) return 'SYMBOL';
    if (type.endsWith('_CHANGED')) return 'ARCHITECTURE';
    if (type.startsWith('COMMAND_')) return 'COMMAND';
    if (type.startsWith('BUILD_')) return 'BUILD';
    if (type.startsWith('TEST_')) return 'TEST';
    if (type.startsWith('LINT_')) return 'LINT';
    if (type.startsWith('TYPECHECK_')) return 'TYPECHECK';
    if (type.endsWith('_REPORTED') || type.startsWith('DIAGNOSTICS_')) return 'DIAGNOSTICS';
    if (type.startsWith('CONTEXT_')) return 'CONTEXT';
    if (type.startsWith('VERIFICATION_')) return 'VERIFICATION';
    if (type.startsWith('AGENT_')) return 'AGENT';
    return 'UNKNOWN';
  }

  public extractAffectedResources(observation: ExecutionObservation): readonly string[] {
    const payload = (observation.payload as Record<string, unknown>) ?? {};
    const resources = new Set<string>();

    if (observation.affectedResources) {
      for (const res of observation.affectedResources) {
        if (typeof res === 'string') resources.add(res);
      }
    }

    if (payload['path'] && typeof payload['path'] === 'string') {
      resources.add(payload['path']);
    }
    if (payload['oldPath'] && typeof payload['oldPath'] === 'string') {
      resources.add(payload['oldPath']);
    }
    if (payload['filePath'] && typeof payload['filePath'] === 'string') {
      resources.add(payload['filePath']);
    }
    if (payload['resource'] && typeof payload['resource'] === 'string') {
      resources.add(payload['resource']);
    }
    if (payload['symbolName'] && typeof payload['symbolName'] === 'string') {
      resources.add(payload['symbolName']);
    }
    if (Array.isArray(payload['modifiedFiles'])) {
      for (const file of payload['modifiedFiles']) {
        if (typeof file === 'string') resources.add(file);
      }
    }
    if (Array.isArray(payload['addedFiles'])) {
      for (const file of payload['addedFiles']) {
        if (typeof file === 'string') resources.add(file);
      }
    }
    if (Array.isArray(payload['files'])) {
      for (const file of payload['files']) {
        if (typeof file === 'string') resources.add(file);
      }
    }
    if (Array.isArray(payload['deletedFiles'])) {
      for (const file of payload['deletedFiles']) {
        if (typeof file === 'string') resources.add(file);
      }
    }
    if (Array.isArray(payload['affectedResources'])) {
      for (const res of payload['affectedResources']) {
        if (typeof res === 'string') resources.add(res);
      }
    }

    return Array.from(resources);
  }

  private determineAffectedTaskState(type: ObservationType): string | undefined {
    switch (type) {
      case 'TASK_STARTED':
        return 'IN_PROGRESS';
      case 'AGENT_BLOCKER':
      case 'TASK_BLOCKED':
        return 'BLOCKED';
      case 'VERIFICATION_STARTED':
        return 'VERIFYING';
      case 'TASK_COMPLETED':
        return 'COMPLETED';
      case 'TASK_FAILED':
        return 'FAILED';
      default:
        return undefined;
    }
  }
}
