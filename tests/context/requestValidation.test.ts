import { describe, it, expect } from 'vitest';
import { ContextPlanValidator } from '../../src/context/planning/ContextPlanValidator.js';
import { ContextPlanningError } from '../../src/context/errors/ContextPlanningError.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';

describe('Context Request Validation', () => {
  it('throws when request is null or missing repositoryId/workspaceId', () => {
    expect(() => ContextPlanValidator.validate(null as any)).toThrow(ContextPlanningError);
    expect(() =>
      ContextPlanValidator.validate({
        repositoryId: '',
        workspaceId: 'ws-1',
        featureIds: ['feat-1'],
      } as ContextRequest)
    ).toThrow(ContextPlanningError);
    expect(() =>
      ContextPlanValidator.validate({
        repositoryId: 'repo-1',
        workspaceId: '   ',
        featureIds: ['feat-1'],
      } as ContextRequest)
    ).toThrow(ContextPlanningError);
  });

  it('throws on invalid token budget or max depth', () => {
    expect(() =>
      ContextPlanValidator.validate({
        repositoryId: 'repo-1',
        workspaceId: 'ws-1',
        featureIds: ['feat-1'],
        tokenBudget: -100,
      })
    ).toThrow(ContextPlanningError);

    expect(() =>
      ContextPlanValidator.validate({
        repositoryId: 'repo-1',
        workspaceId: 'ws-1',
        featureIds: ['feat-1'],
        maxDepth: -1,
      })
    ).toThrow(ContextPlanningError);
  });

  it('throws when output format is unsupported', () => {
    expect(() =>
      ContextPlanValidator.validate({
        repositoryId: 'repo-1',
        workspaceId: 'ws-1',
        featureIds: ['feat-1'],
        outputFormat: 'unknown-format' as any,
      })
    ).toThrow(ContextPlanningError);
  });

  it('throws when no targets or task indicators are provided', () => {
    expect(() =>
      ContextPlanValidator.validate({
        repositoryId: 'repo-1',
        workspaceId: 'ws-1',
      })
    ).toThrow(ContextPlanningError);
  });

  it('passes when valid target feature or changed resources are provided', () => {
    expect(() =>
      ContextPlanValidator.validate({
        repositoryId: 'repo-1',
        workspaceId: 'ws-1',
        featureIds: ['feat-1'],
      })
    ).not.toThrow();

    expect(() =>
      ContextPlanValidator.validate({
        repositoryId: 'repo-1',
        workspaceId: 'ws-1',
        changedResources: ['src/auth/AuthService.ts'],
      })
    ).not.toThrow();

    expect(() =>
      ContextPlanValidator.validate({
        repositoryId: 'repo-1',
        workspaceId: 'ws-1',
        taskText: 'Fix login issue',
      })
    ).not.toThrow();
  });
});
