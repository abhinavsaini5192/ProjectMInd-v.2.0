import type { CLICommand, CLICommandHelp } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import type { ICollaborationManager } from '../../agent/collaboration/interfaces/ICollaborationManager.js';
import { CollaborationManager } from '../../agent/collaboration/services/CollaborationManager.js';
import { InMemoryCollaborationStore } from '../../agent/collaboration/services/InMemoryCollaborationStore.js';
import { ResourceReservationService } from '../../agent/collaboration/services/ResourceReservationService.js';
import { ConflictDetector } from '../../agent/collaboration/services/ConflictDetector.js';
import { HandoffCoordinator } from '../../agent/collaboration/services/HandoffCoordinator.js';

export class CollaborationCommand implements CLICommand {
  public readonly name = 'collaboration';
  public readonly description = 'Inspect and coordinate multi-agent collaboration sessions (Phase 9.5)';
  public readonly aliases: readonly string[] = ['collab'];

  public readonly help: CLICommandHelp = {
    summary: 'Manage multi-agent collaboration sessions, task ownership, reservations, conflicts, and handoffs.',
    usage: 'projectmind collaboration <subcommand> [args] [options]',
    examples: [
      'projectmind collaboration list',
      'projectmind collaboration show collab_12345',
      'projectmind collaboration status collab_12345',
      'projectmind collaboration agents collab_12345',
      'projectmind collaboration conflicts collab_12345',
      'projectmind collaboration handoffs collab_12345',
    ],
    subcommands: [
      { name: 'list', description: 'List active collaboration sessions' },
      { name: 'show', description: 'Show details of a specific collaboration session' },
      { name: 'status', description: 'Inspect collaboration status, active tasks, and blockers' },
      { name: 'agents', description: 'List participants and roles in a collaboration session' },
      { name: 'conflicts', description: 'List open conflicts in a collaboration session' },
      { name: 'handoffs', description: 'List pending and completed handoffs in a collaboration session' },
    ],
    options: [
      { name: 'json', description: 'Output results formatted as JSON', type: 'boolean' },
      { name: 'project', description: 'Filter by specific project ID', type: 'string' },
    ],
  };

  private readonly manager: ICollaborationManager;

  constructor(manager?: ICollaborationManager | undefined) {
    if (manager) {
      this.manager = manager;
    } else {
      const store = new InMemoryCollaborationStore();
      const resv = new ResourceReservationService(store);
      const conf = new ConflictDetector(store);
      const hand = new HandoffCoordinator(store);
      this.manager = new CollaborationManager(store, resv, conf, hand);
    }
  }

  public async execute(context: CLIContext): Promise<CLIResult> {
    const subcommand = context.args[0] ?? 'list';
    const targetId = context.args[1];

    switch (subcommand) {
      case 'list': {
        const projectId = context.options['project'] ? String(context.options['project']) : undefined;
        const sessions = await this.manager.listSessions({
          workspaceId: context.workspacePath ?? 'default',
          projectId,
        });

        if (context.format === 'json' || context.options['json']) {
          return createSuccessResult(this.name, { count: sessions.length, sessions });
        }

        const lines = [`Active Collaboration Sessions (${sessions.length}):`, ''];
        if (sessions.length === 0) {
          lines.push('  No active collaboration sessions found.');
        } else {
          for (const s of sessions) {
            lines.push(`  ${s.collaborationSessionId} — ${s.title}`);
            lines.push(`    Status: ${s.status} | Coordinator: ${s.coordinatorAgentId} | Participants: ${s.participants.length}`);
            lines.push(`    Project: ${s.projectId} | Workspace: ${s.workspaceId}`);
            lines.push('');
          }
        }
        return createSuccessResult(this.name, { sessions }, lines.join('\n'));
      }

      case 'show': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing collaboration session ID. Usage: projectmind collaboration show <id>'
          );
        }

        try {
          const session = await this.manager.getSession(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, session);
          }

          const lines = [
            `Collaboration Session: ${session.title}`,
            `  ID: ${session.collaborationSessionId}`,
            `  Status: ${session.status} (v${session.version})`,
            `  Coordinator: ${session.coordinatorAgentId}`,
            `  Project: ${session.projectId}`,
            `  Workspace: ${session.workspaceId}`,
            '',
            `  Participants (${session.participants.length}):`,
          ];
          for (const p of session.participants) {
            lines.push(`    - ${p.agentId} [${p.role}] (${p.status})`);
          }
          return createSuccessResult(this.name, { session }, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, err.message);
        }
      }

      case 'status': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing collaboration session ID. Usage: projectmind collaboration status <id>'
          );
        }

        try {
          const session = await this.manager.getSession(targetId);
          const conflicts = await (this.manager as any).conflicts.detectConflicts(targetId);
          const reservations = await (this.manager as any).store.listReservations({
            collaborationSessionId: targetId,
            activeOnly: true,
          });
          const handoffs = await (this.manager as any).handoffs.getPendingHandoffs(targetId);
          const participants = await (this.manager as any).store.getParticipants(targetId);
          const ownerships = await (this.manager as any).store.listTaskOwnerships(targetId);

          const statusData = {
            session,
            status: session.status,
            participants,
            ownerships,
            reservations,
            conflicts,
            activeReservations: reservations.length,
            openConflicts: conflicts.length,
            pendingHandoffs: handoffs.length,
          };

          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, statusData);
          }

          const lines = [
            `Status for Collaboration '${session.title}':`,
            `  State: ${session.status}`,
            `  Active Reservations: ${reservations.length}`,
            `  Open Conflicts: ${conflicts.length}`,
            `  Pending Handoffs: ${handoffs.length}`,
            `  Active Tasks & Ownerships (${ownerships.length}):`,
          ];
          for (const o of ownerships) {
            lines.push(`    - Task ${o.taskId}: Owner ${o.ownerAgentId} [${o.status}]`);
          }
          return createSuccessResult(this.name, statusData, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, err.message);
        }
      }

      case 'agents': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing collaboration session ID. Usage: projectmind collaboration agents <id>'
          );
        }

        try {
          const session = await this.manager.getSession(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, session.participants);
          }

          const lines = [`Collaboration Participants (${session.participants.length}):`];
          for (const p of session.participants) {
            lines.push(`  - ${p.agentId} [Role: ${p.role}] Status: ${p.status}`);
          }
          return createSuccessResult(this.name, session.participants, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, err.message);
        }
      }

      case 'conflicts': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing collaboration session ID. Usage: projectmind collaboration conflicts <id>'
          );
        }

        const conflicts = await (this.manager as any).conflicts.detectConflicts(targetId);
        if (context.format === 'json' || context.options['json']) {
          return createSuccessResult(this.name, conflicts);
        }

        const lines = [`Collaboration Conflicts (${conflicts.length}):`];
        if (conflicts.length === 0) {
          lines.push('  No active conflicts detected.');
        } else {
          for (const c of conflicts) {
            lines.push(`  - [${c.severity}] ${c.type}: ${c.description}`);
          }
        }
        return createSuccessResult(this.name, conflicts, lines.join('\n'));
      }

      case 'handoffs': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing collaboration session ID. Usage: projectmind collaboration handoffs <id>'
          );
        }

        const handoffs = await (this.manager as any).store.listHandoffs(targetId);
        if (context.format === 'json' || context.options['json']) {
          return createSuccessResult(this.name, handoffs);
        }

        const lines = [`Collaboration Handoffs (${handoffs.length}):`];
        if (handoffs.length === 0) {
          lines.push('  No handoffs recorded.');
        } else {
          for (const h of handoffs) {
            lines.push(`  - [${h.status}] ${h.sourceAgentId} -> ${h.targetAgentId} (Task: ${h.taskId}): ${h.summary}`);
          }
        }
        return createSuccessResult(this.name, handoffs, lines.join('\n'));
      }

      default:
        return createErrorResult(
          this.name,
          CLIExitCode.INVALID_ARGUMENT,
          `Unknown collaboration subcommand '${subcommand}'. Valid subcommands: list, show, status, agents, conflicts, handoffs.`
        );
    }
  }
}
