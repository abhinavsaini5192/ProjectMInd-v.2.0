import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceManager } from '../workspace/WorkspaceManager';
import { ProjectMindError } from '../errors';

export class SnapshotManager {
  private workspace: WorkspaceManager;
  private snapshotsDir: string;

  constructor(workspace: WorkspaceManager) {
    this.workspace = workspace;
    this.snapshotsDir = this.workspace.getFilePath('snapshots');
  }

  /**
   * Creates a backup of the current state and graph files.
   * For Phase 1 (MVP), we just copy them into a snapshot directory.
   */
  public createSnapshot(commitHash: string): string {
    const snapshotName = `snapshot_${commitHash}_${Date.now()}`;
    const targetDir = path.join(this.snapshotsDir, snapshotName);
    
    try {
      fs.mkdirSync(targetDir, { recursive: true });

      const filesToBackup = ['state.json', 'graph.json', 'history.jsonl'];
      
      for (const file of filesToBackup) {
        const srcPath = this.workspace.getFilePath(file);
        const destPath = path.join(targetDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
      
      return snapshotName;
    } catch (err: any) {
      throw new ProjectMindError(`Failed to create snapshot: ${err.message}`, 'SNAPSHOT_FAILED');
    }
  }

  /**
   * Restores a snapshot by name.
   */
  public restoreSnapshot(snapshotName: string): void {
    const sourceDir = path.join(this.snapshotsDir, snapshotName);
    if (!fs.existsSync(sourceDir)) {
      throw new ProjectMindError(`Snapshot not found: ${snapshotName}`, 'SNAPSHOT_NOT_FOUND');
    }

    try {
      const filesToRestore = ['state.json', 'graph.json', 'history.jsonl'];
      
      for (const file of filesToRestore) {
        const srcPath = path.join(sourceDir, file);
        const destPath = this.workspace.getFilePath(file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    } catch (err: any) {
      throw new ProjectMindError(`Failed to restore snapshot: ${err.message}`, 'SNAPSHOT_RESTORE_FAILED');
    }
  }

  /**
   * Lists all existing snapshot directories.
   */
  public listSnapshots(): string[] {
    if (!fs.existsSync(this.snapshotsDir)) {
      return [];
    }
    return fs.readdirSync(this.snapshotsDir);
  }
}
