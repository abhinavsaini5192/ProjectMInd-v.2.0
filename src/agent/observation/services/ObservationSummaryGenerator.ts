import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type {
  ExecutionObservationSummary,
  VerificationResultsSummary,
} from '../models/ExecutionObservationSummary.js';
import type { ErrorObservationPayload, BlockerObservationPayload } from '../models/payloads/index.js';
import type { IObservationStore } from '../interfaces/IObservationStore.js';

export class ObservationSummaryGenerator {
  constructor(private readonly store: IObservationStore) {}

  public async generateSummary(
    taskId: string,
    workspaceId: string,
    repositoryId: string,
    executionState: string = 'IN_PROGRESS'
  ): Promise<ExecutionObservationSummary> {
    const observations = await this.store.listObservations({
      workspaceId,
      repositoryId,
      taskId,
      limit: 1000,
    });

    const changedResourcesSet = new Set<string>();
    const commandsSet = new Set<string>();
    const errors: ErrorObservationPayload[] = [];
    const blockers: BlockerObservationPayload[] = [];
    const contextInvalidationsSet = new Set<string>();
    const provenanceSummary: Record<string, number> = {};

    let testsPassed = 0;
    let testsFailed = 0;
    let testsSkipped = 0;
    let buildPassed: boolean | undefined = undefined;
    let lintPassed: boolean | undefined = undefined;
    let typeCheckPassed: boolean | undefined = undefined;

    for (const obs of observations) {
      // Provenance count
      const statusKey = typeof obs.provenance === 'string' ? obs.provenance : obs.provenance?.verificationStatus ?? 'UNVERIFIED';
      provenanceSummary[statusKey] = (provenanceSummary[statusKey] ?? 0) + 1;

      const payload = obs.payload as Record<string, unknown>;

      // Changed resources
      if (obs.affectedResources) {
        for (const r of obs.affectedResources) {
          if (typeof r === 'string') changedResourcesSet.add(r);
        }
      }
      if (typeof payload['path'] === 'string') changedResourcesSet.add(payload['path']);
      if (Array.isArray(payload['modifiedFiles'])) {
        for (const f of payload['modifiedFiles']) {
          if (typeof f === 'string') changedResourcesSet.add(f);
        }
      }
      if (Array.isArray(payload['addedFiles'])) {
        for (const f of payload['addedFiles']) {
          if (typeof f === 'string') changedResourcesSet.add(f);
        }
      }
      if (Array.isArray(payload['deletedFiles'])) {
        for (const f of payload['deletedFiles']) {
          if (typeof f === 'string') changedResourcesSet.add(f);
        }
      }

      // Commands
      if (typeof payload['command'] === 'string') {
        commandsSet.add(payload['command']);
      }

      // Verification results
      if (obs.type === 'TEST_COMPLETED') {
        if (typeof payload['testsPassed'] === 'number') testsPassed += payload['testsPassed'];
        if (typeof payload['testsFailed'] === 'number') testsFailed += payload['testsFailed'];
        if (typeof payload['testsSkipped'] === 'number') testsSkipped += payload['testsSkipped'];
      }
      if (obs.type === 'TEST_FAILED') {
        if (typeof payload['testsFailed'] === 'number') testsFailed += payload['testsFailed'];
        else testsFailed += 1;
      }
      if (obs.type === 'BUILD_COMPLETED') buildPassed = true;
      if (obs.type === 'BUILD_FAILED') buildPassed = false;
      if (obs.type === 'LINT_COMPLETED') lintPassed = true;
      if (obs.type === 'LINT_FAILED') lintPassed = false;
      if (obs.type === 'TYPECHECK_COMPLETED') typeCheckPassed = true;
      if (obs.type === 'TYPECHECK_FAILED') typeCheckPassed = false;
      if (obs.type === 'VERIFICATION_PASSED') buildPassed = true;
      if (obs.type === 'VERIFICATION_FAILED') buildPassed = false;

      // Errors
      if (obs.type === 'ERROR_REPORTED') {
        errors.push(payload as unknown as ErrorObservationPayload);
      }

      // Blockers
      if (
        obs.type === 'AGENT_BLOCKER' ||
        obs.type === 'TASK_BLOCKED' ||
        obs.type === 'BLOCKER_ENCOUNTERED'
      ) {
        blockers.push({
          summary: obs.summary || (payload['description'] as string) || 'Blocker encountered',
          ...payload,
        } as unknown as BlockerObservationPayload);
      }

      // Context invalidations
      if (obs.type === 'CONTEXT_INVALIDATED') {
        if (typeof payload['reason'] === 'string') contextInvalidationsSet.add(payload['reason']);
      }
    }

    const conflicts = await this.store.listConflicts(taskId);
    const latestObservation = observations.length > 0 ? observations[observations.length - 1] : undefined;

    const hasVerificationPassed = observations.some(
      (o) => o.type === 'VERIFICATION_PASSED'
    );
    const hasVerificationFailed = observations.some(
      (o) => o.type === 'VERIFICATION_FAILED'
    );
    const passedValue = hasVerificationPassed
      ? true
      : hasVerificationFailed
        ? false
        : (testsPassed > 0 && testsFailed === 0) || buildPassed === true;

    const verificationResults: VerificationResultsSummary = {
      testsPassed: testsPassed > 0 ? testsPassed : undefined,
      testsFailed: testsFailed > 0 ? testsFailed : undefined,
      testsSkipped: testsSkipped > 0 ? testsSkipped : undefined,
      buildPassed,
      lintPassed,
      typeCheckPassed,
    };

    return {
      taskId,
      workspaceId,
      repositoryId,
      executionState,
      changedResources: Array.from(changedResourcesSet),
      commandsReported: Array.from(commandsSet),
      verificationResults,
      errors,
      blockers,
      conflicts,
      contextInvalidations: Array.from(contextInvalidationsSet),
      latestObservation,
      provenanceSummary,
      generatedAt: new Date().toISOString(),
      totalObservations: observations.length,
      verificationResult: { passed: passedValue },
      blockersEncountered: blockers,
      conflictsDetected: conflicts,
    };
  }
}
