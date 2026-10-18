import type { IWorkspaceTemplateManager } from './interfaces/IWorkspaceTemplateManager';
import { WorkspaceType } from './types/FilesystemTypes';

export class WorkspaceTemplateManager implements IWorkspaceTemplateManager {
  generateMetadataTemplate(workspaceId: string, name: string): any {
    return {
      id: workspaceId,
      name,
      lastOpenedAt: new Date().toISOString(),
      createdVersion: '2.0.0',
      type: WorkspaceType.Repository
    };
  }

  generatePointerTemplate(repositoryId: string): any {
    return {
      repositoryId,
      workspaceVersion: '2.0.0',
      createdAt: new Date().toISOString(),
      workspaceType: WorkspaceType.Global
    };
  }

  generateConfigTemplate(): any {
    return {
      autoBackup: true,
      logLevel: 'info',
      maxCacheSizeMB: 1024
    };
  }

  generateWorkspaceReadme(workspaceId: string): string {
    return `# ProjectMind Repository Workspace\n\nID: ${workspaceId}\n\nThis directory contains the runtime state, cache, and semantic graph for a specific repository. **Do not modify these files manually.**`;
  }
}
