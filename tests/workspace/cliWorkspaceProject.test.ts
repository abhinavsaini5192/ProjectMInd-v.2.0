import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLIApplication } from '../../src/cli/core/CLIApplication.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';

describe('Phase 9.2 - CLI Workspace & Project Commands', () => {
  let app: CLIApplication;
  let stdoutLogs: string[];
  let stderrLogs: string[];
  let tempDir: string;

  beforeEach(() => {
    stdoutLogs = [];
    stderrLogs = [];
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projectmind-cli-ws-test-'));

    app = CLIApplication.createDefault({
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('workspace commands', () => {
    it('executes workspace lifecycle: create, list, show, archive, restore', async () => {
      // 1. Create workspace
      const createCode = await app.run(['workspace', 'create', '--name', 'PlatformWS', '--json']);
      expect(createCode).toBe(CLIExitCode.SUCCESS);
      const createRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      expect(createRes.success).toBe(true);
      const wsId = createRes.data.workspaceId;
      expect(wsId).toMatch(/^ws_/);
      expect(createRes.data.slug).toBe('platformws');

      // 2. List workspaces
      const listCode = await app.run(['workspace', 'list', '--json']);
      expect(listCode).toBe(CLIExitCode.SUCCESS);
      const listRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      expect(listRes.data.count).toBeGreaterThanOrEqual(1);
      expect(listRes.data.workspaces.some((w: any) => w.id === wsId)).toBe(true);

      // 3. Show workspace
      const showCode = await app.run(['workspace', 'show', wsId, '--json']);
      expect(showCode).toBe(CLIExitCode.SUCCESS);
      const showRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      expect(showRes.data.workspaceId).toBe(wsId);
      expect(showRes.data.status).toBe('ACTIVE');

      // 4. Archive workspace
      const archiveCode = await app.run(['workspace', 'archive', wsId, '--json']);
      expect(archiveCode).toBe(CLIExitCode.SUCCESS);
      const archiveRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      expect(archiveRes.data.status).toBe('ARCHIVED');

      // 5. Restore workspace
      const restoreCode = await app.run(['workspace', 'restore', wsId, '--json']);
      expect(restoreCode).toBe(CLIExitCode.SUCCESS);
      const restoreRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      expect(restoreRes.data.status).toBe('ACTIVE');
    });

    it('returns error when showing nonexistent workspace', async () => {
      const code = await app.run(['workspace', 'show', 'ws_nonexistent', '--json']);
      expect(code).toBe(CLIExitCode.RESOURCE_NOT_FOUND);
    });
  });

  describe('project commands', () => {
    it('executes project lifecycle: create, list, show, status, archive', async () => {
      // Create parent workspace first
      await app.run(['workspace', 'create', '--name', 'CorpWS', '--json']);
      const wsRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      const wsId = wsRes.data.workspaceId;

      // 1. Create project
      const createCode = await app.run([
        'project',
        'create',
        '--name',
        'AuthService',
        '--workspace',
        wsId,
        '--json',
      ]);
      expect(createCode).toBe(CLIExitCode.SUCCESS);
      const createRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      const projId = createRes.data.projectId;
      expect(projId).toMatch(/^proj_/);

      // 2. List projects
      const listCode = await app.run(['project', 'list', '--workspace', wsId, '--json']);
      expect(listCode).toBe(CLIExitCode.SUCCESS);
      const listRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      expect(listRes.data.count).toBe(1);
      expect(listRes.data.projects[0].id).toBe(projId);

      // 3. Show project
      const showCode = await app.run(['project', 'show', projId, '--json']);
      expect(showCode).toBe(CLIExitCode.SUCCESS);
      const showRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      expect(showRes.data.projectId).toBe(projId);
      expect(showRes.data.name).toBe('AuthService');

      // 4. Project status
      const statusCode = await app.run(['project', 'status', projId, '--workspace', wsId, '--json']);
      expect(statusCode).toBe(CLIExitCode.SUCCESS);
      const statusRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      expect(statusRes.data.projectId).toBe(projId);
      expect(statusRes.data.status).toBe('ACTIVE');

      // 5. Archive project
      const archiveCode = await app.run(['project', 'archive', projId, '--workspace', wsId, '--json']);
      expect(archiveCode).toBe(CLIExitCode.SUCCESS);
      const archiveRes = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      expect(archiveRes.data.status).toBe('ARCHIVED');
    });

    it('initializes project around workspace directory', async () => {
      const code = await app.run(['project', 'init', '--workspace', tempDir, '--name', 'RepoInit', '--json']);
      expect(code).toBe(CLIExitCode.SUCCESS);

      const res = JSON.parse(stdoutLogs[stdoutLogs.length - 1]);
      expect(res.success).toBe(true);
      expect(res.data.projectName).toBe('RepoInit');
      expect(res.data.status).toBe('ACTIVE');
    });
  });

  describe('status and doctor integration', () => {
    it('shows workspace and project information in projectmind status', async () => {
      // First initialize workspace
      await app.run(['init', '--workspace', tempDir, '--name', 'StatusApp', '--json']);

      stdoutLogs = [];
      const code = await app.run(['status', '--workspace', tempDir, '--json']);
      expect(code).toBe(CLIExitCode.SUCCESS);

      const res = JSON.parse(stdoutLogs.join('\n'));
      expect(res.success).toBe(true);
      expect(res.data.workspace).toBeDefined();
      expect(res.data.status).toBe('ACTIVE');
      expect(res.data.health).toBe('HEALTHY');
    });

    it('validates workspace, project, and repository resolution in projectmind doctor', async () => {
      await app.run(['init', '--workspace', tempDir, '--name', 'DoctorApp', '--json']);

      stdoutLogs = [];
      const code = await app.run(['doctor', '--workspace', tempDir, '--json']);
      expect(code).toBe(CLIExitCode.SUCCESS);

      const res = JSON.parse(stdoutLogs.join('\n'));
      expect(res.success).toBe(true);
      expect(res.data.checks).toBeDefined();
      expect(Array.isArray(res.data.checks)).toBe(true);
      expect(res.data.checks.some((c: any) => c.name.toLowerCase().includes('workspace'))).toBe(true);
    });
  });
});
