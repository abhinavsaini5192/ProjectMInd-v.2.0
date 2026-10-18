export type ContextCandidateType =
  | 'FEATURE'
  | 'FILE'
  | 'SYMBOL'
  | 'MODULE'
  | 'PACKAGE'
  | 'ENDPOINT'
  | 'DATABASE_ENTITY'
  | 'CONFIGURATION'
  | 'DEPENDENCY'
  | 'TEST'
  | 'ARCHITECTURE_COMPONENT'
  | 'HISTORY_EVENT'
  | 'HEALTH_SIGNAL'
  | 'RISK'
  | 'IMPACT'
  | 'BEHAVIOR_STEP'
  | 'AGENT_SESSION_CONTEXT'
  | 'PROJECT_MEMORY_REFERENCE';

export type CandidatePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OPTIONAL';

export interface RelevanceDimensions {
  readonly taskRelevance: number;          // 0.0 - 1.0 direct textual/semantic match with task
  readonly featureRelevance: number;       // 0.0 - 1.0 degree of alignment with target feature
  readonly architecturalRelevance: number; // 0.0 - 1.0 structural centrality in architecture graph
  readonly dependencyRelevance: number;    // 0.0 - 1.0 distance in dependency graph
  readonly behavioralRelevance: number;    // 0.0 - 1.0 role in runtime/behavior flows
  readonly changeRelevance: number;        // 0.0 - 1.0 changed in recent work or commit delta
  readonly historyRelevance: number;       // 0.0 - 1.0 historical bug/milestone correlation
  readonly riskRelevance: number;          // 0.0 - 1.0 associated security/coupling risk
  readonly verificationRelevance: number;  // 0.0 - 1.0 associated failed test/verification
  readonly recency: number;                // 0.0 - 1.0 recency weight
  readonly confidence: number;             // 0.0 - 1.0 confidence in relevance assessment
  readonly scopeRelevance: number;         // 1.0 if inside project scope, 0.0 if cross-project
}

export interface ContextCandidate {
  readonly candidateId: string;
  readonly id?: string | undefined;
  readonly candidateType: ContextCandidateType;
  readonly type?: ContextCandidateType | string | undefined;
  readonly name: string;
  readonly path?: string | undefined;
  readonly symbolSignature?: string | undefined;
  readonly score: number;                  // Composite weighted score 0.0 - 1.0
  readonly priority: CandidatePriority;
  readonly isMandatory?: boolean | undefined;
  readonly dimensions: RelevanceDimensions;
  readonly primaryEvidence: string;
  readonly sourceFragment?: string | undefined;
  readonly estimatedTokens: number;
  readonly sizeTokens?: number | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface ContextExclusion {
  readonly candidateId: string;
  readonly candidateType: ContextCandidateType;
  readonly name: string;
  readonly score: number;
  readonly reason: string;
  readonly stage: 'SCOPE_CHECK' | 'RELEVANCE_THRESHOLD' | 'TOKEN_BUDGET' | 'DUPLICATE' | 'MANUAL_EXCLUSION';
}
