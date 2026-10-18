import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import { WorkspaceService } from '../../workspace/services/WorkspaceService.js';
import { PersistentWorkspaceProjectRepository } from '../../workspace/persistence/PersistentWorkspaceProjectRepository.js';

export class WorkspaceCommand implements CLICommand {
  public readonly name = 'workspace';
  public readonly description = 'Manages ProjectMind workspaces (list, show, create, archive, restore).';
  public readonly usage = 'projectmind workspace <list|show|create|archive|restore> [workspace_id] [--name <name>] [--json]';
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'name',
      description: 'Workspace display name for create command',
      hasValue: true,
    },
    {
      name: 'slug',
      description: 'Custom slug for create command',
      hasValue: true,
    },
    {
      name: 'description',
      description: 'Optional description for the workspace',
      hasValue: true,
    },
    {
      name: 'json',
      description: 'Output workspace data in JSON format',
      hasValue: false,
    },
  ];
  public readonly examples = [
    'projectmind workspace list',
    'projectmind workspace create --name "Engineering"',
    'projectmind workspace show ws_123',
    'projectmind workspace archive ws_123',
  ];

  private readonly service: WorkspaceService;

  constructor(service?: WorkspaceService) {
    this.service = service ?? new WorkspaceService(new PersistentWorkspaceProjectRepository());
  }

  public async execute(ctx: CLIContext): Promise<CLIResult> {
    const action = ctx.args[0] ?? 'list';
    const targetId = ctx.args[1];

    switch (action) {
      case 'list': {
        const list = await this.service.listWorkspaces();
        const data = {
          count: list.length,
          workspaces: list.map((w) => ({
            id: w.workspaceId,
            name: w.name,
            slug: w.slug,
            status: w.status,
            createdAt: w.createdAt,
          })),
        };
        return createSuccessResult(
          this.name,
          data,
          list.length > 0 ? `Found ${list.length} workspace(s)` : 'No workspaces found. Create one with: projectmind workspace create <name>'
        );
      }

      case 'show': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing workspace identifier. Usage: projectmind workspace show <workspace_id>'
          );
        }
        try {
          const ws = await this.service.getWorkspace(targetId);
          return createSuccessResult(this.name, ws, `Workspace '${ws.name}' (${ws.workspaceId})`);
        } catch (err: unknown) {
          return createErrorResult(
            this.name,
            CLIExitCode.RESOURCE_NOT_FOUND,
            `Workspace '${targetId}' was not found.`
          );
        }
      }

      case 'create': {
        const name = (ctx.options['name'] as string) ?? targetId;
        if (!name) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Workspace name is required. Usage: projectmind workspace create <name> [--slug <slug>]'
          );
        }
        const created = await this.service.createWorkspace({
          name,
          slug: ctx.options['slug'] as string | undefined,
          description: ctx.options['description'] as string | undefined,
        });
        return createSuccessResult(
          this.name,
          created,
          `Workspace '${created.name}' created successfully with ID: ${created.workspaceId}`
        );
      }

      case 'archive': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Workspace ID required. Usage: projectmind workspace archive <workspace_id>'
          );
        }
        const archived = await this.service.archiveWorkspace(targetId);
        return createSuccessResult(
          this.name,
          archived,
          `Workspace '${archived.name}' archived successfully.`
        );
      }

      case 'restore': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Workspace ID required. Usage: projectmind workspace restore <workspace_id>'
          );
        }
        const restored = await this.service.restoreWorkspace(targetId);
        return createSuccessResult(
          this.name,
          restored,
          `Workspace '${restored.name}' restored to ACTIVE status.`
        );
      }

      default:
        return createErrorResult(
          this.name,
          CLIExitCode.INVALID_USAGE,
          `Unknown workspace action '${action}'. Valid actions: list, show, create, archive, restore.`
        );
    }
  }
}
