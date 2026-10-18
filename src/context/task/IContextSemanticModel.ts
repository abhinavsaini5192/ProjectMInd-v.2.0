import type { TaskUnderstanding, TaskType, TaskIntent } from '../models/TaskUnderstanding.js';
import type { ContextCandidate } from '../models/ContextCandidate.js';
import type { ContextPackage } from '../models/ContextPackage.js';
import type { ResourceScope } from '../../security/models/ResourceScope.js';

export interface TaskInterpretationResult {
  readonly taskType: TaskType;
  readonly intent: TaskIntent;
  readonly targetEntities: readonly string[];
  readonly candidateFeatures: readonly string[];
  readonly requestedAction: string;
  readonly constraints: Array<{
    type: 'EXPLICIT_CONSTRAINT' | 'INFERRED_CONSTRAINT';
    description: string;
    confidence: number;
    source: string;
  }>;
  readonly confidence: number;
  readonly provenance: string;
}

export interface IContextSemanticModel {
  interpretTask(rawText: string, scope?: ResourceScope): Promise<TaskInterpretationResult>;
  rankCandidates?(candidates: ContextCandidate[], task: TaskUnderstanding): Promise<ContextCandidate[]>;
  compressContext?(content: string, maxTokens: number): Promise<string>;
  explainContext?(pkg: ContextPackage): Promise<Record<string, string>>;
}
