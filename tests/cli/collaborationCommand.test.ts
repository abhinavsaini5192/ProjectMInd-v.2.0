import { describe, it, expect, beforeEach } from 'vitest';
import { CLIApplication } from '../../src/cli/core/CLIApplication.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';
import { CollaborationCommand } from '../../src/cli/commands/CollaborationCommand.js';
import { CollaborationManager } from '../../src/agent/collaboration/services/CollaborationManager.js';
import { InMemoryCollaborationStore } from '../../src/agent/collaboration/services/InMemoryCollaborationStore.js';
import { ResourceReservationService } from '../../src/agent/collaboration/services/ResourceReservationService.js';
import { ConflictDetector } from '../../src/agent/collaboration/services/ConflictDetector.js';
import { HandoffCoordinator } from '../../src/agent/collaboration/services/HandoffCoordinator.js';
import { CommandRegistry } from '../../src/cli/core/CommandRegistry.js';

describe('Collaboration CLI Command Suite (Phase 9.5 Section 41)', () => {
  let store: InMemoryCollaborationStore;
  let reservations: ResourceReservationService;
  let conflicts: ConflictDetector;
  let handoffs: HandoffCoordinator;
  let manager: CollaborationManager;
  let command: CollaborationCommand;
  let app: CLIApplication;
  let stdoutLogs: string[];
  let stderrLogs: string[];

  const workspaceId = 'ws_cli_test';
  const projectId = 'proj_cli_test';

  beforeEach(async () => {
    stdoutLogs = [];
    stderrLogs = [];

    store = new InMemoryCollaborationStore();
    reservations = new ResourceReservationService(store);
    conflicts = new ConflictDetector(store);
    handoffs = new HandoffCoordinator(store);
    manager = new CollaborationManager(store, reservations, conflicts, handoffs);
    command = new CollaborationCommand(manager);

    const registry = new CommandRegistry();
    registry.register(command);

    app = new CLIApplication({
      registry,
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    });
  });

  describe('projectmind collaboration list', () => {
    it('lists sessions in human-readable and json formats', async () => {
      // Initially empty
      let exitCode = await app.run(['collaboration', 'list', '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      let json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data.count).toBe(0);
      expect(json.data.sessions).toEqual([]);

      // Create a session
      await manager.createSession({
        workspaceId,
        projectId,
        title: 'Auth Refactor Squad',
        coordinatorAgentId: 'agent_coord',
      });

      stdoutLogs = [];
      exitCode = await app.run(['collaboration', 'list', '--workspace', workspaceId, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data.count).toBe(1);
      expect(json.data.sessions[0].title).toBe('Auth Refactor Squad');

      // Human readable format
      stdoutLogs = [];
      exitCode = await app.run(['collaboration', 'list', '--workspace', workspaceId]);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      const output = stdoutLogs.join('\n');
      expect(output).toContain('Active Collaboration Sessions (1)');
      expect(output).toContain('Auth Refactor Squad');
    });
  });

  describe('projectmind collaboration show <id>', () => {
    it('shows detailed session information', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Payments Migration',
        coordinatorAgentId: 'agent_payments_lead',
        description: 'Multi-service payments migration',
      });

      let exitCode = await app.run(['collaboration', 'show', session.collaborationSessionId, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      let json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data.collaborationSessionId).toBe(session.collaborationSessionId);
      expect(json.data.title).toBe('Payments Migration');
      expect(json.data.coordinatorAgentId).toBe('agent_payments_lead');

      // Human readable
      stdoutLogs = [];
      exitCode = await app.run(['collaboration', 'show', session.collaborationSessionId]);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      const text = stdoutLogs.join('\n');
      expect(text).toContain('Collaboration Session: Payments Migration');
      expect(text).toContain('agent_payments_lead');
    });

    it('returns error when session id is missing or not found', async () => {
      let exitCode = await app.run(['collaboration', 'show']);
      expect(exitCode).toBe(CLIExitCode.INVALID_ARGUMENT);

      stdoutLogs = [];
      stderrLogs = [];
      exitCode = await app.run(['collaboration', 'show', 'non_existent_session_123']);
      expect(exitCode).toBe(CLIExitCode.NOT_FOUND);
    });
  });

  describe('projectmind collaboration status <id>', () => {
    it('inspects session status, active tasks, and participants', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Status Inspection Suite',
        coordinatorAgentId: 'agent_coord',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_worker',
        role: 'IMPLEMENTER',
        capabilities: ['fullstack'],
      });

      await manager.assignTask(session.collaborationSessionId, 'task_core', 'agent_worker');

      const exitCode = await app.run(['collaboration', 'status', session.collaborationSessionId, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data.session.title).toBe('Status Inspection Suite');
      expect(json.data.participants.length).toBe(2);
      expect(json.data.ownerships.length).toBe(1);
      expect(json.data.ownerships[0].ownerAgentId).toBe('agent_worker');

      // Human readable
      stdoutLogs = [];
      await app.run(['collaboration', 'status', session.collaborationSessionId]);
      const text = stdoutLogs.join('\n');
      expect(text).toContain('State: ACTIVE');
      expect(text).toContain('Active Tasks & Ownerships (1)');
      expect(text).toContain('task_core');
    });
  });

  describe('projectmind collaboration agents <id>', () => {
    it('lists participants and their roles', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Roster Review',
        coordinatorAgentId: 'agent_coord',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_reviewer',
        role: 'REVIEWER',
        capabilities: ['security-audit'],
      });

      const exitCode = await app.run(['collaboration', 'agents', session.collaborationSessionId, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data.length).toBe(2);
      const roles = json.data.map((p: any) => p.role);
      expect(roles).toContain('COORDINATOR');
      expect(roles).toContain('REVIEWER');

      // Human readable
      stdoutLogs = [];
      await app.run(['collaboration', 'agents', session.collaborationSessionId]);
      const text = stdoutLogs.join('\n');
      expect(text).toContain('Collaboration Participants (2)');
      expect(text).toContain('agent_reviewer');
      expect(text).toContain('Role: REVIEWER');
    });
  });

  describe('projectmind collaboration conflicts <id>', () => {
    it('lists detected conflicts', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Conflict Review',
        coordinatorAgentId: 'agent_coord',
      });

      const exitCode = await app.run(['collaboration', 'conflicts', session.collaborationSessionId, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data).toEqual([]);

      // Human readable
      stdoutLogs = [];
      await app.run(['collaboration', 'conflicts', session.collaborationSessionId]);
      const text = stdoutLogs.join('\n');
      expect(text).toContain('No active conflicts detected.');
    });
  });

  describe('projectmind collaboration handoffs <id>', () => {
    it('lists pending and completed handoffs', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Handoff Audit',
        coordinatorAgentId: 'agent_coord',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_backend',
        role: 'IMPLEMENTER',
      });
      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_frontend',
        role: 'IMPLEMENTER',
      });
      await manager.assignTask(session.collaborationSessionId, 'task_api', 'agent_backend');

      await handoffs.proposeHandoff({
        collaborationSessionId: session.collaborationSessionId,
        sourceAgentId: 'agent_backend',
        targetAgentId: 'agent_frontend',
        taskId: 'task_api',
        projectId,
        summary: 'Backend schemas delivered',
        completedWork: ['REST endpoints'],
        remainingWork: ['Frontend client SDK'],
        changedResources: ['src/api/auth.ts'],
        verificationStatus: 'SYSTEM_VERIFIED',
      });

      const exitCode = await app.run(['collaboration', 'handoffs', session.collaborationSessionId, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data.length).toBe(1);
      expect(json.data[0].summary).toBe('Backend schemas delivered');

      // Human readable
      stdoutLogs = [];
      await app.run(['collaboration', 'handoffs', session.collaborationSessionId]);
      const text = stdoutLogs.join('\n');
      expect(text).toContain('Collaboration Handoffs (1)');
      expect(text).toContain('agent_backend -> agent_frontend');
      expect(text).toContain('Backend schemas delivered');
    });
  });

  describe('unknown subcommand', () => {
    it('returns invalid argument exit code for unknown subcommand', async () => {
      const exitCode = await app.run(['collaboration', 'foobar']);
      expect(exitCode).toBe(CLIExitCode.INVALID_ARGUMENT);
    });
  });
});
