export type ArtifactType =
  | 'ANALYSIS_RESULT'
  | 'DESIGN_DECISION'
  | 'IMPLEMENTATION_REPORT'
  | 'CODE_DIFF'
  | 'API_CONTRACT'
  | 'SCHEMA_MIGRATION'
  | 'TEST_REPORT'
  | 'VERIFICATION_EVIDENCE'
  | 'DOCUMENTATION_UPDATE'
  | 'REVIEW_RESULT'
  | 'OTHER';

export interface TaskArtifact {
  readonly artifactId: string;
  readonly planId: string;
  readonly nodeId: string;
  readonly taskId: string;
  readonly type: ArtifactType;
  readonly title: string;
  readonly content: unknown;
  readonly provenance: string;
  readonly version: number;
  readonly timestamp: number;
  readonly verificationEvidence?: readonly string[] | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
