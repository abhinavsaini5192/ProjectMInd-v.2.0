import type { TaskUnderstanding } from '../models/TaskUnderstanding.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import type { IContextSemanticModel } from './IContextSemanticModel.js';
import { DeterministicSemanticModel } from './DeterministicSemanticModel.js';
import type { ResourceScope } from '../../security/models/ResourceScope.js';
import * as crypto from 'crypto';

export class TaskUnderstandingEngine {
  private readonly semanticModel: IContextSemanticModel;
  private readonly fallbackModel: DeterministicSemanticModel;

  constructor(semanticModel?: IContextSemanticModel) {
    this.fallbackModel = new DeterministicSemanticModel();
    this.semanticModel = semanticModel ?? this.fallbackModel;
  }

  public async understandTask(request: ContextRequest): Promise<TaskUnderstanding> {
    const rawText = request.taskText ?? request.query ?? '';
    const normalized = rawText.trim().replace(/\s+/g, ' ');

    const scope: ResourceScope = {
      workspaceId: request.workspaceId,
      projectId: request.projectId ?? request.projectContext?.projectId,
      repositoryId: request.repositoryId,
    };

    let interpretation: any;
    let usedFallback = false;

    try {
      interpretation = await this.semanticModel.interpretTask(normalized, scope);

      const VALID_TASK_TYPES = new Set([
        'IMPLEMENTATION',
        'BUG_FIX',
        'REFACTOR',
        'DEBUGGING',
        'EXPLANATION',
        'INVESTIGATION',
        'TESTING',
        'REVIEW',
        'DOCUMENTATION',
        'ARCHITECTURE',
        'PERFORMANCE',
        'SECURITY',
        'MIGRATION',
        'UNKNOWN',
      ]);
      const VALID_INTENTS = new Set([
        'ADD',
        'MODIFY',
        'REMOVE',
        'DEBUG',
        'UNDERSTAND',
        'EXPLAIN',
        'REVIEW',
        'TEST',
        'OPTIMIZE',
        'MIGRATE',
        'INVESTIGATE',
        'DESIGN',
        'TRACE',
        'COMPARE',
        'UNKNOWN',
      ]);

      // Validate schema of interpretation
      if (
        !interpretation ||
        !VALID_TASK_TYPES.has(interpretation.taskType) ||
        !VALID_INTENTS.has(interpretation.intent)
      ) {
        throw new Error('Malformed semantic model output or invalid taskType/intent');
      }
    } catch {
      // Safe fallback on any AI failure, timeout, or malformed output
      interpretation = await this.fallbackModel.interpretTask(normalized, scope);
      usedFallback = true;
    }

    const taskId = request.requestId ?? `task_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // Schema and bounds sanitization
    const boundedConfidence = Math.max(0.0, Math.min(1.0, Number(interpretation.confidence) || 0.5));
    const targetEntities = Array.isArray(interpretation.targetEntities)
      ? interpretation.targetEntities.filter((e: any) => typeof e === 'string')
      : [];
    const candidateFeatures = Array.isArray(interpretation.candidateFeatures)
      ? interpretation.candidateFeatures.filter((f: any) => typeof f === 'string')
      : [];

    // Ensure inferred constraints never exceed 0.7 confidence
    const sanitizedConstraints = (interpretation.constraints ?? []).map((c: any) => {
      let conf = Number(c.confidence) || 0.5;
      if (c.type === 'INFERRED_CONSTRAINT' && conf > 0.7) {
        conf = 0.7;
      }
      return {
        type: c.type === 'EXPLICIT_CONSTRAINT' ? 'EXPLICIT_CONSTRAINT' : 'INFERRED_CONSTRAINT',
        description: String(c.description || ''),
        confidence: Math.max(0.1, Math.min(1.0, conf)),
        source: String(c.source || 'SANITIZED'),
      };
    });

    return {
      taskId,
      rawRequest: rawText,
      normalizedRequest: normalized,
      taskType: interpretation.taskType ?? 'UNKNOWN',
      intent: interpretation.intent ?? 'UNKNOWN',
      targetEntities,
      candidateFeatures,
      candidateResources: request.resourceIds ?? [],
      requestedAction: interpretation.requestedAction ?? normalized,
      constraints: sanitizedConstraints,
      scope,
      confidence: usedFallback ? Math.min(boundedConfidence, 0.85) : boundedConfidence,
      provenance: usedFallback ? 'DETERMINISTIC_FALLBACK' : (interpretation.provenance ?? 'SEMANTIC_MODEL'),
    };
  }
}
