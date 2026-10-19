import type { IRetrievalRanker } from '../interfaces/IRetrievalEngine.js';
import type { RetrievalResult, RetrievalConflict, RetrievalDimensions } from '../models/RetrievalResult.js';
import type { SemanticQuery } from '../models/SemanticQuery.js';
import { SOURCE_AUTHORITY_RANK } from '../models/RetrievalSource.js';

export class HybridRetrievalRanker implements IRetrievalRanker {
  public async rank(
    candidates: readonly RetrievalResult[],
    query: SemanticQuery
  ): Promise<RetrievalResult[]> {
    if (candidates.length === 0) return [];

    // 1. Detect Conflicts across candidates (e.g., authoritative fact vs. semantic/unverified claim)
    const detectedConflicts = this.detectConflicts(candidates);

    // 2. Score and Weight Candidates
    const scored = candidates.map((cand) => {
      const dimensions = this.calculateDimensions(cand, query);
      const compositeScore = this.calculateCompositeScore(dimensions);

      // Check if this candidate is involved in any conflict
      const candConflicts = detectedConflicts.filter(
        (c) =>
          c.resourceId === cand.resourceId ||
          c.conflictingClaimA.includes(cand.name) ||
          c.conflictingClaimB.includes(cand.name) ||
          (Array.isArray(cand.metadata?.['relatedResources']) &&
            cand.metadata['relatedResources'].includes(c.resourceId))
      );

      return {
        ...cand,
        dimensions,
        score: compositeScore,
        conflicts: candConflicts.length > 0 ? candConflicts : undefined,
      };
    });

    // 3. Sort Descending by Score
    scored.sort((a, b) => b.score - a.score);

    // 4. Filter out zero/below-threshold scores
    const minScore = query.filters?.minScore ?? 0.15;
    const filtered = scored.filter((c) => c.score >= minScore && c.score > 0.0);

    // 5. Apply Query Limit if provided
    const limit = query.filters?.limit ?? 25;
    return filtered.slice(0, limit);
  }

  private calculateDimensions(
    cand: RetrievalResult,
    query: SemanticQuery
  ): RetrievalDimensions {
    const textLower = query.text.toLowerCase();
    const candLower = `${cand.name} ${cand.snippet ?? ''} ${cand.contentReference ?? ''}`.toLowerCase();

    // 1. Lexical Relevance: exact word match & exact symbol identification
    const nameLower = cand.name.toLowerCase();
    const symbolLower = typeof cand.metadata?.['symbolName'] === 'string'
      ? (cand.metadata['symbolName'] as string).toLowerCase()
      : undefined;
    const isExactSymbol = nameLower === textLower || symbolLower === textLower;

    const words = textLower.split(/\W+/).filter((w) => w.length > 2);
    let lexicalMatches = 0;
    for (const w of words) {
      if (candLower.includes(w)) lexicalMatches++;
    }

    let lexicalRelevance = Math.min(1.0, lexicalMatches > 0 ? 0.3 + lexicalMatches * 0.15 : 0.1);
    if (isExactSymbol) {
      lexicalRelevance = 1.0;
    }

    // 2. Semantic Relevance: from existing score if from SEMANTIC_INDEX
    const semanticRelevance =
      cand.source === 'SEMANTIC_INDEX'
        ? cand.score
        : cand.dimensions?.semanticRelevance ?? 0.5;

    // 3. Feature Relevance
    const isTargetFeat = query.targetFeatures?.some((f) => candLower.includes(f.toLowerCase())) ?? false;
    const featureRelevance = isTargetFeat || cand.source === 'FEATURE_KNOWLEDGE' ? 0.95 : 0.4;

    // 4. Graph Relevance
    const graphRelevance = cand.source === 'KNOWLEDGE_GRAPH' ? 0.9 : 0.5;

    // 5. Task Relevance
    const taskRelevance =
      query.taskIntent && candLower.includes(String(query.taskIntent).toLowerCase())
        ? 0.85
        : lexicalRelevance;

    // 6. Recency
    const recency = cand.dimensions?.recency ?? 0.7;

    // 7. Confidence
    const confidence = cand.confidence;

    // 8. Source Authority: normalized from 0-100 scale to 0-1.0
    const rawAuth = SOURCE_AUTHORITY_RANK[cand.authority] ?? 40;
    const sourceAuthority = rawAuth / 100;

    // 9. Scope Relevance: 1.0 if perfectly matching requested scope
    let scopeRelevance = 1.0;
    if (query.projectId && cand.metadata?.['projectId'] && cand.metadata['projectId'] !== query.projectId) {
      scopeRelevance = 0.0;
    }

    // 10. Verification Relevance
    const verificationRelevance = cand.source === 'VERIFICATION' ? 0.9 : 0.5;

    return {
      lexicalRelevance,
      semanticRelevance,
      featureRelevance,
      graphRelevance,
      taskRelevance,
      recency,
      confidence,
      sourceAuthority,
      scopeRelevance,
      verificationRelevance,
    };
  }

  private calculateCompositeScore(dim: RetrievalDimensions): number {
    // If scope is violated, final score drops to 0
    if (dim.scopeRelevance === 0.0) return 0.0;

    // If query has virtually no lexical match and low semantic relevance, drop score to 0.0
    if (dim.lexicalRelevance <= 0.1 && dim.semanticRelevance < 0.25) {
      return 0.0;
    }

    // Weighted combination strictly ensuring source authority and semantic relevance are accounted for
    const raw =
      dim.lexicalRelevance * 0.20 +
      dim.semanticRelevance * 0.25 +
      dim.sourceAuthority * 0.25 + // Source authority strongly protects against ungrounded suggestions
      dim.featureRelevance * 0.10 +
      dim.confidence * 0.10 +
      dim.taskRelevance * 0.10;

    return Math.round(Math.min(1.0, Math.max(0.01, raw)) * 1000) / 1000;
  }

  private detectConflicts(candidates: readonly RetrievalResult[]): RetrievalConflict[] {
    const conflicts: RetrievalConflict[] = [];

    // Compare pairs of candidates referencing the same resource or concept
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i]!;
        const b = candidates[j]!;

        const aRelated = Array.isArray(a.metadata?.['relatedResources']) ? a.metadata['relatedResources'] : [];
        const bRelated = Array.isArray(b.metadata?.['relatedResources']) ? b.metadata['relatedResources'] : [];

        const sameResource =
          a.resourceId === b.resourceId ||
          aRelated.includes(b.resourceId) ||
          bRelated.includes(a.resourceId) ||
          aRelated.some((r: string) => bRelated.includes(r));

        const authA = SOURCE_AUTHORITY_RANK[a.authority];
        const authB = SOURCE_AUTHORITY_RANK[b.authority];

        // If one is high authority and one is lower, check for contradiction keywords
        if (sameResource && Math.abs(authA - authB) >= 20) {
          const aText = (a.snippet ?? a.name).toLowerCase();
          const bText = (b.snippet ?? b.name).toLowerCase();

          // Contradiction patterns: e.g. "migrated away", "deprecated", "removed", "no longer"
          const aNegatesB = aText.includes('migrated away') || aText.includes('deprecated') || aText.includes('no longer');
          const bNegatesA = bText.includes('migrated away') || bText.includes('deprecated') || bText.includes('no longer');

          if (aNegatesB || bNegatesA) {
            conflicts.push({
              conflictId: `conf_${Date.now()}_${i}_${j}`,
              resourceId: aRelated.includes(b.resourceId) ? b.resourceId : a.resourceId,
              conflictingClaimA: a.snippet ?? a.name,
              sourceA: a.source,
              authorityA: a.authority,
              conflictingClaimB: b.snippet ?? b.name,
              sourceB: b.source,
              authorityB: b.authority,
              detectedAt: Date.now(),
              resolution:
                authA > authB
                  ? `Authoritative fact (${a.source}) takes precedence over lower-authority source (${b.source})`
                  : `Authoritative fact (${b.source}) takes precedence over lower-authority source (${a.source})`,
            });
          }
        }
      }
    }

    return conflicts;
  }
}
