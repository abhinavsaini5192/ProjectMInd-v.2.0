import type { DIContainer } from '../../workspace/di/DIContainer.js';
import { StorageTokens } from './StorageTokens.js';
import { TransactionManager } from '../consistency/TransactionManager.js';
import { OptimisticLockManager } from '../consistency/OptimisticLockManager.js';
import { StorageIntegrityValidator } from '../consistency/StorageIntegrityValidator.js';
import { StorageMigrationManager } from '../migration/StorageMigrationManager.js';
import { RetentionPolicy } from '../lifecycle/RetentionPolicy.js';
import { DeletionPolicy } from '../lifecycle/DeletionPolicy.js';
import { InMemoryArchiveStore } from '../lifecycle/ArchivalPolicy.js';
import { DataLifecycleManager } from '../lifecycle/DataLifecycleManager.js';
import { StorageBackupManager } from '../recovery/StorageBackupManager.js';
import { StorageRestoreManager } from '../recovery/StorageRestoreManager.js';
import { StorageRecoveryManager } from '../recovery/RecoveryPoint.js';
import { StorageHealthService } from '../health/StorageHealthService.js';
import { PersistentAuditStore } from '../repositories/PersistentAuditStore.js';
import { PersistentKnowledgeUpdateRepository } from '../repositories/PersistentKnowledgeUpdateRepository.js';
import { PersistentVerificationStore } from '../repositories/PersistentVerificationStore.js';
import { PersistentObservationStore } from '../repositories/PersistentObservationStore.js';
import { WorkspaceIsolationRepository } from '../repositories/WorkspaceIsolationRepository.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export interface StorageDISetupOptions {
  readonly environment?: string | undefined;
  readonly applicationVersion?: string | undefined;
  readonly requiredSchemaVersion?: number | undefined;
  readonly logger?: ILogger | undefined;
}

export class StorageDISetup {
  public static registerStorageModule(
    container: DIContainer,
    options: StorageDISetupOptions = {}
  ): void {
    const logger = options.logger;

    // Consistency
    const transactionManager = new TransactionManager(logger);
    const concurrencyManager = new OptimisticLockManager(logger);
    const integrityValidator = new StorageIntegrityValidator(logger);

    container.registerFactory(StorageTokens.TransactionManager, () => transactionManager, 'Singleton');
    container.registerFactory(StorageTokens.ConcurrencyManager, () => concurrencyManager, 'Singleton');
    container.registerFactory(StorageTokens.IntegrityValidator, () => integrityValidator, 'Singleton');

    // Migration
    const migrationManager = new StorageMigrationManager({
      environment: options.environment ?? 'development',
      transactionManager,
      logger,
    });
    container.registerFactory(StorageTokens.MigrationManager, () => migrationManager, 'Singleton');

    // Lifecycle
    const retentionPolicy = new RetentionPolicy();
    const deletionPolicy = new DeletionPolicy();
    const archiveStore = new InMemoryArchiveStore();
    const lifecycleManager = new DataLifecycleManager({
      retentionPolicy,
      deletionPolicy,
      archiveStore,
      logger,
    });

    container.registerFactory(StorageTokens.RetentionPolicy, () => retentionPolicy, 'Singleton');
    container.registerFactory(StorageTokens.DeletionPolicy, () => deletionPolicy, 'Singleton');
    container.registerFactory(StorageTokens.ArchiveStore, () => archiveStore, 'Singleton');
    container.registerFactory(StorageTokens.DataLifecycleManager, () => lifecycleManager, 'Singleton');

    // Recovery
    const backupManager = new StorageBackupManager({
      applicationVersion: options.applicationVersion ?? '1.0.0',
      getStorageVersion: () => migrationManager.getCurrentVersion(),
      logger,
    });

    const restoreManager = new StorageRestoreManager({
      backupManager,
      getCurrentStorageVersion: () => migrationManager.getCurrentVersion(),
      transactionManager,
      logger,
    });

    const recoveryManager = new StorageRecoveryManager(
      options.applicationVersion ?? '1.0.0',
      () => migrationManager.getCurrentVersion(),
      logger
    );

    container.registerFactory(StorageTokens.BackupManager, () => backupManager, 'Singleton');
    container.registerFactory(StorageTokens.RestoreManager, () => restoreManager, 'Singleton');
    container.registerFactory(StorageTokens.RecoveryManager, () => recoveryManager, 'Singleton');

    // Health
    const healthService = new StorageHealthService({
      migrationManager,
      integrityValidator,
      requiredSchemaVersion: options.requiredSchemaVersion,
      logger,
    });
    container.registerFactory(StorageTokens.StorageHealthService, () => healthService, 'Singleton');

    // Repositories
    const auditStore = new PersistentAuditStore(logger);
    const knowledgeUpdateRepo = new PersistentKnowledgeUpdateRepository(logger);
    const verificationStore = new PersistentVerificationStore(logger);
    const observationStore = new PersistentObservationStore(logger);
    const workspaceIsolationRepo = new WorkspaceIsolationRepository(logger);

    container.registerFactory(StorageTokens.PersistentAuditStore, () => auditStore, 'Singleton');
    container.registerFactory(StorageTokens.PersistentKnowledgeUpdateRepository, () => knowledgeUpdateRepo, 'Singleton');
    container.registerFactory(StorageTokens.PersistentVerificationStore, () => verificationStore, 'Singleton');
    container.registerFactory(StorageTokens.PersistentObservationStore, () => observationStore, 'Singleton');
    container.registerFactory(StorageTokens.WorkspaceIsolationRepository, () => workspaceIsolationRepo, 'Singleton');
  }
}
