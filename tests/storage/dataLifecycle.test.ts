import { describe, it, expect } from 'vitest';
import { DataLifecycleManager } from '../../src/storage/lifecycle/DataLifecycleManager';
import { RetentionPolicy } from '../../src/storage/lifecycle/RetentionPolicy';
import { DeletionPolicy } from '../../src/storage/lifecycle/DeletionPolicy';
import { InMemoryArchiveStore } from '../../src/storage/lifecycle/ArchivalPolicy';
import { LifecycleEntity } from '../../src/storage/lifecycle/DataLifecycleTypes';
import { StorageCoreError } from '../../src/storage/types/StorageErrors';

describe('Phase 8.4 - Data Lifecycle, Retention, Archival & Deletion', () => {
  it('should evaluate entity lifecycle state based on retention policies', async () => {
    const retentionPolicy = new RetentionPolicy();
    const deletionPolicy = new DeletionPolicy();
    const archiveStore = new InMemoryArchiveStore();
    const manager = new DataLifecycleManager({ retentionPolicy, deletionPolicy, archiveStore });

    const now = Date.now();
    const entity: LifecycleEntity = {
      entityType: 'CONTEXT_SESSION',
      entityId: 'ctx-100',
      workspaceId: 'ws-1',
      state: 'ACTIVE',
      isSoftDeleted: false,
      payload: {},
      createdAt: now - 3 * 86400000, // 3 days ago (stale after 1 day)
      updatedAt: now - 3 * 86400000,
      version: 1,
    };

    const evaluation = manager.evaluate(entity);
    expect(evaluation.recommendedState).toBe('STALE');
  });

  it('should enforce immutable retention on Audit records preventing archival or deletion', async () => {
    const retentionPolicy = new RetentionPolicy();
    const deletionPolicy = new DeletionPolicy();
    const archiveStore = new InMemoryArchiveStore();
    const manager = new DataLifecycleManager({ retentionPolicy, deletionPolicy, archiveStore });

    const auditEntity: LifecycleEntity = {
      entityType: 'AUDIT_EVENT',
      entityId: 'audit-event-1',
      workspaceId: 'ws-1',
      state: 'ACTIVE',
      isSoftDeleted: false,
      payload: {},
      createdAt: Date.now() - 365 * 86400000, // 1 year ago
      updatedAt: Date.now() - 365 * 86400000,
      version: 1,
    };

    const evaluation = manager.evaluate(auditEntity);
    expect(evaluation.recommendedState).toBe('ACTIVE');

    // Attempting to purge audit entity must throw StorageCoreError
    await expect(manager.purge(auditEntity)).rejects.toThrow(StorageCoreError);
  });

  it('should perform soft deletion with metadata recorded', () => {
    const retentionPolicy = new RetentionPolicy();
    const deletionPolicy = new DeletionPolicy();
    const archiveStore = new InMemoryArchiveStore();
    const manager = new DataLifecycleManager({ retentionPolicy, deletionPolicy, archiveStore });

    const entity: LifecycleEntity = {
      entityType: 'FEATURE',
      entityId: 'feat-legacy',
      workspaceId: 'ws-1',
      state: 'ACTIVE',
      isSoftDeleted: false,
      payload: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    const softDeleted = manager.softDelete(entity, 'admin-user', 'Deprecated in v2');

    expect(softDeleted.state).toBe('DELETED');
    expect(softDeleted.isSoftDeleted).toBe(true);
    expect(softDeleted.softDeleteMetadata).toBeDefined();
    expect(softDeleted.softDeleteMetadata?.deletedBy).toBe('admin-user');
    expect(softDeleted.softDeleteMetadata?.deletionReason).toBe('Deprecated in v2');
    expect(softDeleted.softDeleteMetadata?.deletedAt).toBeLessThanOrEqual(Date.now());
  });

  it('should archive and restore entity using archive store', async () => {
    const retentionPolicy = new RetentionPolicy();
    const deletionPolicy = new DeletionPolicy();
    const archiveStore = new InMemoryArchiveStore();
    const manager = new DataLifecycleManager({ retentionPolicy, deletionPolicy, archiveStore });

    const entity: LifecycleEntity = {
      entityType: 'KNOWLEDGE_UPDATE',
      entityId: 'task-archive-me',
      workspaceId: 'ws-1',
      state: 'ARCHIVABLE',
      isSoftDeleted: false,
      createdAt: Date.now() - 30 * 86400000,
      updatedAt: Date.now() - 30 * 86400000,
      version: 1,
      payload: { title: 'Completed run' },
    };

    const archivedEntity = await manager.archive(entity);
    expect(archivedEntity.state).toBe('ARCHIVED');
    expect(archivedEntity.entityId).toBe('task-archive-me');

    const storedPkg = await archiveStore.retrieveByEntity('KNOWLEDGE_UPDATE', 'task-archive-me');
    expect(storedPkg).toBeDefined();
    expect(storedPkg?.entityId).toBe('task-archive-me');

    // Restore
    const restored = await manager.restore('task-archive-me', 'KNOWLEDGE_UPDATE');
    expect(restored.state).toBe('ACTIVE');
    expect(restored.entityId).toBe('task-archive-me');
  });

  it('should provide clear human-readable lifecycle explanation', () => {
    const retentionPolicy = new RetentionPolicy();
    const deletionPolicy = new DeletionPolicy();
    const archiveStore = new InMemoryArchiveStore();
    const manager = new DataLifecycleManager({ retentionPolicy, deletionPolicy, archiveStore });

    const entity: LifecycleEntity = {
      entityType: 'FEATURE',
      entityId: 'feat-2',
      workspaceId: 'ws-1',
      state: 'ACTIVE',
      isSoftDeleted: false,
      payload: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    const explanation = manager.explain(entity);
    expect(explanation).toContain('FEATURE');
    expect(explanation).toContain('ACTIVE');
    expect(explanation).toContain('Deletion Strategy');
  });

  it('should specify correct deletion cascade rules for canonical entities', () => {
    const registry = new DeletionPolicy();

    const wsRule = registry.getCascadeAction('WORKSPACE', 'REPOSITORY');
    expect(wsRule).toBe('RESTRICT');

    const featRule = registry.getCascadeAction('FEATURE', 'FEATURE_DEPENDENCY');
    expect(featRule).toBe('DETACH');

    const auditRule = registry.getCascadeAction('WORKSPACE', 'AUDIT_EVENT');
    expect(auditRule).toBe('DETACH');
  });
});
