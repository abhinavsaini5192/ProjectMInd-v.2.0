import type { ContextCandidate, ContextExclusion } from '../models/ContextCandidate.js';
import type { TaskUnderstanding } from '../models/TaskUnderstanding.js';

export interface ExpansionResult {
  readonly selectedCandidates: ContextCandidate[];
  readonly exclusions: ContextExclusion[];
  readonly totalTokens: number;
  readonly maxReachedLevel: number;
}

export class ContextExpansionEngine {
  public expand(
    scoredCandidates: readonly ContextCandidate[],
    task: TaskUnderstanding,
    tokenBudget: number = 4000,
    relevanceThreshold: number = 0.25
  ): ExpansionResult {
    const selected: ContextCandidate[] = [];
    const exclusions: ContextExclusion[] = [];
    let currentTokens = 0;
    let maxLevel = 0;

    // Define level mapping for candidate types
    const getCandidateLevel = (type: string): number => {
      switch (type) {
        case 'FEATURE':
          return 1;
        case 'FILE':
        case 'SYMBOL':
          return 2;
        case 'DEPENDENCY':
          return 3;
        case 'BEHAVIOR_STEP':
        case 'ENDPOINT':
          return 4;
        case 'HISTORY_EVENT':
        case 'RISK':
        case 'TEST':
          return 5;
        default:
          return 3;
      }
    };

    // Sort descending by score
    const sorted = [...scoredCandidates].sort((a, b) => b.score - a.score);

    for (const cand of sorted) {
      const level = getCandidateLevel(cand.candidateType);

      // Condition 1: Relevance threshold check
      if (cand.score < relevanceThreshold) {
        exclusions.push({
          candidateId: cand.candidateId,
          candidateType: cand.candidateType,
          name: cand.name,
          score: cand.score,
          reason: `Relevance score ${cand.score} is below minimum threshold ${relevanceThreshold}`,
          stage: 'RELEVANCE_THRESHOLD',
        });
        continue;
      }

      // Condition 2: Token budget check
      const nextTotal = currentTokens + cand.estimatedTokens;
      if (nextTotal > tokenBudget) {
        // If critical and first item, allow it; otherwise exclude
        if (selected.length === 0 && cand.priority === 'CRITICAL') {
          selected.push(cand);
          currentTokens += cand.estimatedTokens;
          maxLevel = Math.max(maxLevel, level);
        } else {
          exclusions.push({
            candidateId: cand.candidateId,
            candidateType: cand.candidateType,
            name: cand.name,
            score: cand.score,
            reason: `Including candidate would exceed token budget (${nextTotal} > ${tokenBudget})`,
            stage: 'TOKEN_BUDGET',
          });
        }
        continue;
      }

      // Candidate accepted
      selected.push(cand);
      currentTokens += cand.estimatedTokens;
      maxLevel = Math.max(maxLevel, level);
    }

    return {
      selectedCandidates: selected,
      exclusions,
      totalTokens: currentTokens,
      maxReachedLevel: maxLevel,
    };
  }
}
