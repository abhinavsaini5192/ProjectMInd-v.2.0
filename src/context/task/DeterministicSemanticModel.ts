import type { IContextSemanticModel, TaskInterpretationResult } from './IContextSemanticModel.js';
import type { TaskType, TaskIntent } from '../models/TaskUnderstanding.js';
import type { ContextCandidate } from '../models/ContextCandidate.js';
import type { ResourceScope } from '../../security/models/ResourceScope.js';

export class DeterministicSemanticModel implements IContextSemanticModel {
  public async interpretTask(rawText: string, _scope?: ResourceScope): Promise<TaskInterpretationResult> {
    const text = rawText.trim();
    const lower = text.toLowerCase();

    // 1. Classify Task Type
    const taskType = this.classifyTaskType(lower);

    // 2. Classify Task Intent
    const intent = this.classifyTaskIntent(lower, taskType);

    // 3. Extract Explicit Constraints
    const constraints: Array<{
      type: 'EXPLICIT_CONSTRAINT' | 'INFERRED_CONSTRAINT';
      description: string;
      confidence: number;
      source: string;
    }> = [];

    const constraintRegex = /\b(?:do not|don't|without|only modify|only change|keep|never)\s+([^,.;]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = constraintRegex.exec(text)) !== null) {
      constraints.push({
        type: 'EXPLICIT_CONSTRAINT',
        description: match[0].trim(),
        confidence: 0.95,
        source: 'PATTERN_MATCH_EXPLICIT',
      });
    }

    // Inferred constraint with bounded confidence
    if (taskType === 'BUG_FIX' || taskType === 'DEBUGGING') {
      constraints.push({
        type: 'INFERRED_CONSTRAINT',
        description: 'Maintain existing API compatibility and avoid breaking public contracts',
        confidence: 0.65,
        source: 'HEURISTIC_RULE_INFERRED',
      });
    }

    // 4. Candidate Features and Target Entities
    const domainKeywords = [
      'auth',
      'authentication',
      'oauth',
      'login',
      'session',
      'payment',
      'billing',
      'order',
      'checkout',
      'user',
      'database',
      'cache',
      'notification',
      'api',
      'gateway',
      'security',
    ];

    const candidateFeatures: string[] = [];
    const targetEntities: string[] = [];

    for (const kw of domainKeywords) {
      if (lower.includes(kw)) {
        candidateFeatures.push(kw);
      }
    }

    // Extract potential symbol/entity references (PascalCase or camelCase or dot notation)
    const entityMatches = text.match(/\b[A-Za-z]+(?:[A-Z][a-z0-9]+|\.[a-zA-Z]+)+\b/g);
    if (entityMatches) {
      targetEntities.push(...entityMatches);
    }

    const confidence = taskType !== 'UNKNOWN' ? 0.9 : 0.4;

    return {
      taskType,
      intent,
      targetEntities: Array.from(new Set(targetEntities)),
      candidateFeatures: Array.from(new Set(candidateFeatures)),
      requestedAction: text,
      constraints,
      confidence,
      provenance: 'DETERMINISTIC_RULES',
    };
  }

  public async rankCandidates(candidates: ContextCandidate[]): Promise<ContextCandidate[]> {
    // Sort descending by score
    return [...candidates].sort((a, b) => b.score - a.score);
  }

  private classifyTaskType(lower: string): TaskType {
    if (/\b(why|what causes|investigate|diagnose)\b/.test(lower)) {
      return 'INVESTIGATION';
    }
    if (/\b(debug|timeout|trace|401|500|exception)\b/.test(lower)) {
      return 'DEBUGGING';
    }
    if (/\b(fix|bug|error|fail|crash|patch)\b/.test(lower)) {
      return 'BUG_FIX';
    }
    if (/\b(test|tests|coverage|spec|mock)\b/.test(lower)) {
      return 'TESTING';
    }
    if (/\b(refactor|clean up|cleanup|reorganize|restructure)\b/.test(lower)) {
      return 'REFACTOR';
    }
    if (/\b(optimize|slow|latency|perf|benchmark)\b/.test(lower)) {
      return 'PERFORMANCE';
    }
    if (/\b(security|vulnerability|leak|sanitize)\b/.test(lower)) {
      return 'SECURITY';
    }
    if (/\b(review|audit|inspection)\b/.test(lower)) {
      return 'REVIEW';
    }
    if (/\b(architecture|design|topology)\b/.test(lower)) {
      return 'ARCHITECTURE';
    }
    if (/\b(migrate|migration|upgrade)\b/.test(lower)) {
      return 'MIGRATION';
    }
    if (/\b(explain|how does|describe)\b/.test(lower)) {
      return 'EXPLANATION';
    }
    if (/\b(document|docs|readme)\b/.test(lower)) {
      return 'DOCUMENTATION';
    }
    if (/\b(add|create|implement|build|support)\b/.test(lower)) {
      return 'IMPLEMENTATION';
    }
    return 'UNKNOWN';
  }

  private classifyTaskIntent(lower: string, taskType: TaskType): TaskIntent {
    if (/\b(debug|troubleshoot|timeout)\b/.test(lower) || taskType === 'DEBUGGING') return 'DEBUG';
    if (/\b(fix|bug|patch|resolve)\b/.test(lower) || taskType === 'BUG_FIX') return 'DEBUG';
    if (/\b(test|tests|verify|coverage)\b/.test(lower) || taskType === 'TESTING') return 'TEST';
    if (/\b(refactor|cleanup)\b/.test(lower) || taskType === 'REFACTOR') return 'MODIFY';
    if (/\b(optimize|speed up|tune)\b/.test(lower) || taskType === 'PERFORMANCE') return 'OPTIMIZE';
    if (/\b(add|create|introduce|new)\b/.test(lower) || taskType === 'IMPLEMENTATION') return 'ADD';
    if (/\b(modify|update|change)\b/.test(lower)) return 'MODIFY';
    if (/\b(remove|delete|deprecate)\b/.test(lower)) return 'REMOVE';
    if (/\b(why|investigate)\b/.test(lower) || taskType === 'INVESTIGATION') return 'INVESTIGATE';
    if (/\b(explain|describe)\b/.test(lower) || taskType === 'EXPLANATION') return 'EXPLAIN';
    if (/\b(review|audit)\b/.test(lower) || taskType === 'REVIEW') return 'REVIEW';
    if (/\b(design|architect)\b/.test(lower) || taskType === 'ARCHITECTURE') return 'DESIGN';
    if (/\b(migrate)\b/.test(lower) || taskType === 'MIGRATION') return 'MIGRATE';
    if (/\b(trace)\b/.test(lower)) return 'TRACE';
    if (/\b(compare)\b/.test(lower)) return 'COMPARE';
    if (/\b(understand)\b/.test(lower)) return 'UNDERSTAND';
    return 'UNKNOWN';
  }
}
