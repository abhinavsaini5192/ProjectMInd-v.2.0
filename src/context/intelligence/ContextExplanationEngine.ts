import type { ContextCandidate, ContextExclusion } from '../models/ContextCandidate.js';
import type { TaskUnderstanding } from '../models/TaskUnderstanding.js';

export interface ExplanationSummary {
  readonly selectedReasons: Record<string, string>;
  readonly exclusionReasons: Record<string, string>;
  readonly markdownExplanation: string;
}

export class ContextExplanationEngine {
  public generateExplanations(
    selected: readonly ContextCandidate[],
    exclusions: readonly ContextExclusion[],
    task: TaskUnderstanding
  ): ExplanationSummary {
    const selectedReasons: Record<string, string> = {};
    const exclusionReasons: Record<string, string> = {};

    const mdLines: string[] = [
      `### Context Selection Explanation`,
      `**Task:** ${task.normalizedRequest}`,
      `**Task Type:** ${task.taskType} (Intent: ${task.intent}, Confidence: ${task.confidence})`,
      ``,
      `#### Selected Knowledge (${selected.length} items):`,
    ];

    for (const cand of selected) {
      const reason = `[${cand.priority}] ${cand.primaryEvidence} (Score: ${cand.score})`;
      selectedReasons[cand.candidateId] = reason;
      mdLines.push(`- **${cand.candidateType}**: \`${cand.name}\` — ${reason}`);
    }

    if (exclusions.length > 0) {
      mdLines.push(``, `#### Notable Exclusions (${exclusions.length} items):`);
      for (const exc of exclusions) {
        exclusionReasons[exc.candidateId] = `[${exc.stage}] ${exc.reason}`;
        mdLines.push(`- **${exc.candidateType}**: \`${exc.name}\` — ${exc.reason} (Score: ${exc.score})`);
      }
    }

    return {
      selectedReasons,
      exclusionReasons,
      markdownExplanation: mdLines.join('\n'),
    };
  }
}
