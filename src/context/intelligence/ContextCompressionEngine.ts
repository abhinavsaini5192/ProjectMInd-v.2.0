import type { SourceFragment } from '../models/ContextPackage.js';
import type { ContextCandidate } from '../models/ContextCandidate.js';

export class ContextCompressionEngine {
  public compress(
    candidates: readonly ContextCandidate[],
    mode: 'FULL' | 'COMPACT' | 'SUMMARY' | 'REFERENCE_ONLY' = 'COMPACT'
  ): {
    compressedCandidates: ContextCandidate[];
    sourceFragments: SourceFragment[];
  } {
    const sourceFragments: SourceFragment[] = [];
    const compressedCandidates: ContextCandidate[] = [];

    for (const cand of candidates) {
      if (cand.candidateType === 'FILE' && cand.path) {
        // If candidate has sourceFragment or symbol signature, extract slice
        if (cand.sourceFragment || cand.symbolSignature) {
          const fragmentText = this.formatFragment(cand.sourceFragment ?? cand.name, mode);
          sourceFragments.push({
            path: cand.path,
            symbol: cand.symbolSignature,
            fragment: fragmentText,
            startLine: 1,
            endLine: 40,
          });

          compressedCandidates.push({
            ...cand,
            estimatedTokens: Math.max(30, Math.round(cand.estimatedTokens * 0.4)),
          });
          continue;
        }

        // Apply compression mode to token estimates
        let factor = 1.0;
        if (mode === 'COMPACT') factor = 0.8;
        if (mode === 'SUMMARY') factor = 0.4;
        if (mode === 'REFERENCE_ONLY') factor = 0.15;

        compressedCandidates.push({
          ...cand,
          estimatedTokens: Math.max(20, Math.round(cand.estimatedTokens * factor)),
        });
      } else {
        compressedCandidates.push(cand);
      }
    }

    return {
      compressedCandidates,
      sourceFragments,
    };
  }

  private formatFragment(raw: string, mode: string): string {
    if (mode === 'FULL') return raw;
    if (mode === 'REFERENCE_ONLY') return `// Symbol Declaration only: ${raw.slice(0, 80)}`;

    // COMPACT: compress consecutive empty lines and trailing whitespace
    return raw
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
