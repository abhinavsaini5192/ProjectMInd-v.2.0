import { describe, it, expect } from 'vitest';
import { WorkspaceIsolationRepository } from '../../src/storage/repositories/WorkspaceIsolationRepository';
import { StorageCoreError } from '../../src/storage/types/StorageErrors';

describe('Phase 8.4 - Workspace and Repository Isolation', () => {
  it('should associate repositories with a workspace and retrieve bound workspace', () => {
    const repo = new WorkspaceIsolationRepository();

    repo.registerRepositoryScope('repo-alpha', 'ws-1');
    repo.registerRepositoryScope('repo-beta', 'ws-1');
    repo.registerRepositoryScope('repo-gamma', 'ws-2');

    expect(repo.getWorkspaceForRepository('repo-alpha')).toBe('ws-1');
    expect(repo.getWorkspaceForRepository('repo-beta')).toBe('ws-1');
    expect(repo.getWorkspaceForRepository('repo-gamma')).toBe('ws-2');
    expect(repo.getWorkspaceForRepository('repo-unknown')).toBeUndefined();
  });

  it('should reject registering an already assigned repository to a different workspace (prevent reassignment)', () => {
    const repo = new WorkspaceIsolationRepository();

    repo.registerRepositoryScope('repo-alpha', 'ws-1');

    expect(() => {
      repo.registerRepositoryScope('repo-alpha', 'ws-2');
    }).toThrow(StorageCoreError);

    // Idempotent re-registration for the same workspace is allowed
    expect(() => {
      repo.registerRepositoryScope('repo-alpha', 'ws-1');
    }).not.toThrow();
  });

  it('should allow write validation when entity matches context workspace', () => {
    const repo = new WorkspaceIsolationRepository();
    repo.registerRepositoryScope('repo-alpha', 'ws-1');

    expect(() => {
      repo.validateWriteScope(
        { id: 'feat-1', workspaceId: 'ws-1', repositoryId: 'repo-alpha' },
        'ws-1'
      );
    }).not.toThrow();
  });

  it('should reject write validation when entity workspace does not match current workspace', () => {
    const repo = new WorkspaceIsolationRepository();

    expect(() => {
      repo.validateWriteScope(
        { id: 'feat-1', workspaceId: 'ws-1' },
        'ws-2'
      );
    }).toThrow(StorageCoreError);
  });

  it('should reject write validation when entity repository is bound to a different workspace', () => {
    const repo = new WorkspaceIsolationRepository();
    repo.registerRepositoryScope('repo-alpha', 'ws-1');

    expect(() => {
      repo.validateWriteScope(
        { id: 'task-100', workspaceId: 'ws-2', repositoryId: 'repo-alpha' },
        'ws-2'
      );
    }).toThrow(StorageCoreError);
  });

  it('should validate read scope and prevent cross-workspace reads', () => {
    const repo = new WorkspaceIsolationRepository();

    const allowed = repo.validateReadScope(
      { id: 'doc-1', workspaceId: 'ws-1' },
      'ws-1'
    );
    expect(allowed).toBe(true);

    const blocked = repo.validateReadScope(
      { id: 'doc-1', workspaceId: 'ws-1' },
      'ws-2'
    );
    expect(blocked).toBe(false);
  });
});
