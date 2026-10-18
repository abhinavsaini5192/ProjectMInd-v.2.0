import type { TestVerificationResult } from './results/TestVerificationResult.js';
import type { BuildVerificationResult } from './results/BuildVerificationResult.js';
import type { LintVerificationResult } from './results/LintVerificationResult.js';
import type { TypeCheckVerificationResult } from './results/TypeCheckVerificationResult.js';
import type { StaticAnalysisVerificationResult } from './results/StaticAnalysisVerificationResult.js';
import type { SecurityScanResult } from './results/SecurityScanResult.js';

export interface VerificationEvidence {
  readonly summary: string;
  readonly testResults?: readonly TestVerificationResult[] | undefined;
  readonly buildResult?: BuildVerificationResult | undefined;
  readonly lintResult?: LintVerificationResult | undefined;
  readonly typeCheckResult?: TypeCheckVerificationResult | undefined;
  readonly staticAnalysisResult?: StaticAnalysisVerificationResult | undefined;
  readonly securityScanResult?: SecurityScanResult | undefined;
  readonly reportReference?: string | undefined;
  readonly ciRunId?: string | undefined;
  readonly artifactReferences?: readonly string[] | undefined;
  readonly resourceMappings?: readonly string[] | undefined;
  readonly featureMappings?: readonly string[] | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
