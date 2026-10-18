import type { ExecutionObservation } from './ExecutionObservation.js';
import type { ObservationConflict } from './ObservationConflict.js';
import type { ErrorObservationPayload, BlockerObservationPayload } from './payloads/index.js';

export interface VerificationResultsSummary {
  readonly testsPassed?: number | undefined;
  readonly testsFailed?: number | undefined;
  readonly testsSkipped?: number | undefined;
  readonly buildPassed?: boolean | undefined;
  readonly lintPassed?: boolean | undefined;
  readonly typeCheckPassed?: boolean | undefined;
}

export interface ExecutionObservationSummary {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly executionState: string;
  readonly changedResources: readonly string[];
  readonly commandsReported: readonly string[];
  readonly verificationResults: VerificationResultsSummary;
  readonly errors: readonly ErrorObservationPayload[];
  readonly blockers: readonly BlockerObservationPayload[];
  readonly conflicts: readonly ObservationConflict[];
  readonly contextInvalidations: readonly string[];
  readonly latestObservation?: ExecutionObservation | undefined;
  readonly provenanceSummary: Record<string, number>;
  readonly generatedAt: string;

  // Convenient aggregation accessors
  readonly totalObservations?: number | undefined;
  readonly verificationResult?: { readonly passed?: boolean | undefined } | undefined;
  readonly blockersEncountered?: readonly any[] | undefined;
  readonly conflictsDetected?: readonly any[] | undefined;
}
