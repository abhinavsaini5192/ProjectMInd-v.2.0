import type { RetrievalSource, SourceAuthority } from './RetrievalSource.js';

export interface RetrievalConflict {
  readonly conflictId: string;
  readonly resourceId: string;
  readonly conflictingClaimA: string;
  readonly sourceA: RetrievalSource;
  readonly authorityA: SourceAuthority;
  readonly conflictingClaimB: string;
  readonly sourceB: RetrievalSource;
  readonly authorityB: SourceAuthority;
  readonly detectedAt: number;
  readonly resolution?: string | undefined;
}

export interface RetrievalDimensions {
  readonly lexicalRelevance: number;
  readonly semanticRelevance: number;
  readonly featureRelevance: number;
  readonly graphRelevance: number;
  readonly taskRelevance: number;
  readonly recency: number;
  readonly confidence: number;
  readonly sourceAuthority: number;
  readonly scopeRelevance: number;
  readonly verificationRelevance: number;
}

export interface RetrievalResult {
  readonly candidateId: string;
  readonly resourceId: string;
  readonly resourceType: string;
  readonly name: string;
  readonly contentReference?: string | undefined;
  readonly snippet?: string | undefined;
  readonly source: RetrievalSource;
  readonly score: number;
  readonly dimensions: RetrievalDimensions;
  readonly authority: SourceAuthority;
  readonly confidence: number;
  readonly evidence: string[];
  readonly conflicts?: RetrievalConflict[] | undefined;
  readonly metadata?: Record<string, any> | undefined;
}
