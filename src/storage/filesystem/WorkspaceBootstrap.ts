import { DIContainer } from '../../workspace/di/DIContainer';
import { IEventBusToken, type IEventBus } from '../../workspace/interfaces/IEventBus';
import { ILoggerToken, type ILogger } from '../../workspace/interfaces/ILogger';
import * as path from 'path';

import { WorkspaceFilesystem } from './WorkspaceFilesystem';
import { WorkspaceDirectoryManager } from './WorkspaceDirectoryManager';
import { WorkspaceFileManager } from './WorkspaceFileManager';
import { WorkspacePointerManager } from './WorkspacePointerManager';
import { WorkspaceTemplateManager } from './WorkspaceTemplateManager';
import { WorkspacePermissions } from './WorkspacePermissions';
import { WorkspaceLockManager } from './WorkspaceLockManager';
import { WorkspaceCleanupManager } from './WorkspaceCleanupManager';

import { IWorkspaceFilesystemToken } from './interfaces/IWorkspaceFilesystem';
import { IWorkspaceDirectoryManagerToken } from './interfaces/IWorkspaceDirectoryManager';
import { IWorkspaceFileManagerToken } from './interfaces/IWorkspaceFileManager';
import { IWorkspacePointerManagerToken } from './interfaces/IWorkspacePointerManager';
import { IWorkspaceTemplateManagerToken } from './interfaces/IWorkspaceTemplateManager';
import { IWorkspacePermissionsToken } from './interfaces/IWorkspacePermissions';
import { GlobalWorkspaceLayout, RepositoryWorkspaceLayout } from './models/WorkspaceLayout';
import { FilesystemEvents } from './types/FilesystemEvents';

export const WorkspaceLockManagerToken = Symbol.for('WorkspaceLockManager');
export const WorkspaceCleanupManagerToken = Symbol.for('WorkspaceCleanupManager');

export class WorkspaceBootstrap {
  static configure(container: DIContainer): void {
    container.registerSingleton(IWorkspaceDirectoryManagerToken, WorkspaceDirectoryManager);
    container.registerSingleton(IWorkspaceFileManagerToken, WorkspaceFileManager);
    container.registerSingleton(IWorkspacePermissionsToken, WorkspacePermissions);
    container.registerSingleton(IWorkspaceTemplateManagerToken, WorkspaceTemplateManager);
    
    container.registerSingleton(IWorkspacePointerManagerToken, WorkspacePointerManager, [
      IWorkspaceFileManagerToken
    ]);

    container.registerSingleton(WorkspaceLockManagerToken, WorkspaceLockManager, [
      IWorkspaceFileManagerToken
    ]);

    container.registerSingleton(WorkspaceCleanupManagerToken, WorkspaceCleanupManager, [
      IWorkspaceDirectoryManagerToken,
      IWorkspaceFileManagerToken
    ]);

    container.registerSingleton(IWorkspaceFilesystemToken, WorkspaceFilesystem, [
      IWorkspaceDirectoryManagerToken,
      IWorkspaceFileManagerToken,
      IWorkspacePointerManagerToken,
      IWorkspacePermissionsToken,
      IWorkspaceTemplateManagerToken,
      WorkspaceLockManagerToken,
      WorkspaceCleanupManagerToken
    ]);
  }

  static async initializeGlobalWorkspace(
    fs: WorkspaceFilesystem,
    eventBus: IEventBus,
    logger: ILogger
  ): Promise<void> {
    const rootPath = fs.getGlobalWorkspacePath();
    logger.info({ component: 'WorkspaceBootstrap', operation: 'initGlobal', message: `Initializing Global Workspace at ${rootPath}` });
    
    await fs.directories.ensureDirectory(rootPath);
    await fs.directories.createStructure(rootPath, GlobalWorkspaceLayout);

    const configPath = `${rootPath}/config/config.json`;
    if (!(await fs.files.fileExists(configPath))) {
      await fs.files.writeJson(configPath, fs.templates.generateConfigTemplate());
    }

    eventBus.publish(FilesystemEvents.WorkspaceCreated, { path: rootPath, type: 'global' });
  }

  static async initializeRepositoryWorkspace(
    fs: WorkspaceFilesystem,
    repositoryId: string,
    repositoryPath: string,
    eventBus: IEventBus,
    logger: ILogger
  ): Promise<void> {
    logger.info({ component: 'WorkspaceBootstrap', operation: 'initRepo', message: `Initializing Repo Workspace for ${repositoryId}` });
    
    const repoWorkspacePath = fs.getRepositoryWorkspacePath(repositoryId);
    
    await fs.directories.ensureDirectory(repoWorkspacePath);
    await fs.directories.createStructure(repoWorkspacePath, RepositoryWorkspaceLayout);

    const metadataPath = `${repoWorkspacePath}/metadata/metadata.json`;
    if (!(await fs.files.fileExists(metadataPath))) {
      await fs.files.writeJson(metadataPath, fs.templates.generateMetadataTemplate(repositoryId, path.basename(repositoryPath)));
    }

    const readmePath = `${repoWorkspacePath}/README.md`;
    if (!(await fs.files.fileExists(readmePath))) {
      await fs.files.writeText(readmePath, fs.templates.generateWorkspaceReadme(repositoryId));
    }

    const pointer = fs.templates.generatePointerTemplate(repositoryId);
    await fs.pointers.writePointer(repositoryPath, pointer);
    
    eventBus.publish(FilesystemEvents.PointerCreated, { repositoryPath, repositoryId });
    eventBus.publish(FilesystemEvents.WorkspaceCreated, { path: repoWorkspacePath, type: 'repository' });
  }
}
