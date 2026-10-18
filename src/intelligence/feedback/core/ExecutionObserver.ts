import { ExecutionObservation } from '../models/ExecutionObservation.js';
import { ExecutionResult } from '../../../agent/execution/models/ExecutionResult.js';
import { ActionPlan } from '../../planning/models/ActionPlan.js';

export class ExecutionObserver {
  public observe(execution: Partial<ExecutionResult>, plan?: ActionPlan): ExecutionObservation {
    const observationId = `obs_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const changedFiles: string[] = [];
    const createdFiles: string[] = [];
    const deletedFiles: string[] = [];

    for (const change of (execution.changes || []) as any[]) {
      if (typeof change === 'string') {
        changedFiles.push(change);
      } else if (change && typeof change === 'object') {
        if (change.type === 'CREATED') createdFiles.push(change.path);
        else if (change.type === 'DELETED') deletedFiles.push(change.path);
        else if (change.path) changedFiles.push(change.path);
      }
    }

    return {
      observationId,
      executionId: execution.executionId || `exec_${Date.now()}`,
      planId: plan?.planId || 'unknown_plan',
      repositoryId: 'repo_1',
      workspaceId: 'workspace_1',
      timestamp: Date.now(),
      executionStatus: (execution.status as string) || 'COMPLETED',
      changedFiles,
      createdFiles,
      deletedFiles,
      movedFiles: [],
      executedCommands: (execution.actions || []).map(a => a.actionId),
      testResults: {
        passed: execution.status === 'SUCCEEDED' || (execution.failed || 0) === 0,
        testsRun: (execution.actions || []).length,
        testsPassed: execution.succeeded || 0,
        testsFailed: (execution.errors || []).filter(e => e.toLowerCase().includes('test') || e.toLowerCase().includes('assertion')).length,
        failures: (execution.errors || []).filter(e => e.toLowerCase().includes('test') || e.toLowerCase().includes('assertion'))
      },
      buildResults: {
        success: (execution.errors || []).filter(e => e.toLowerCase().includes('compiler') || e.toLowerCase().includes('syntax') || e.toLowerCase().includes('typeerror')).length === 0,
        errors: (execution.errors || []).filter(e => e.toLowerCase().includes('compiler') || e.toLowerCase().includes('syntax') || e.toLowerCase().includes('typeerror'))
      },
      architectureResults: {
        violationsDetected: [],
        violationsResolved: []
      },
      verificationResults: {
        passed: (execution.failed || 0) === 0,
        checks: ['Syntax', 'Dependency Graph']
      },
      errors: execution.errors || [],
      warnings: execution.warnings || []
    };
  }
}
