import * as path from 'path';
import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import { ProjectService } from '../../workspace/services/ProjectService.js';
import { WorkspaceService } from '../../workspace/services/WorkspaceService.js';
import { PersistentWorkspaceProjectRepository } from '../../workspace/persistence/PersistentWorkspaceProjectRepository.js';

export class ProjectCommand implements CLICommand {
  public readonly name = 'project';
  public readonly description = 'Manages ProjectMind projects (list, show, create, init, status, archive, attach, detach).';
  public readonly usage = 'projectmind project <list|show|create|init|status|archive|attach|detach> [project_id|name] [--workspace <ws>] [--json]';
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'name',
      description: 'Project display name for create command',
      hasValue: true,
    },
    {
      name: 'workspace',
      description: 'Workspace ID to associate the project with',
      hasValue: true,
    },
    {
      name: 'type',
      description: 'Project type (SERVICE, APPLICATION, LIBRARY, MONOREPO, MULTI_REPO, INFRASTRUCTURE, RESEARCH)',
      hasValue: true,
    },
    {
      name: 'repo',
      description: 'Repository ID to attach or detach',
      hasValue: true,
    },
    {
      name: 'json',
      description: 'Output project data in JSON format',
      hasValue: false,
    },
  ];
  public readonly examples = [
    'projectmind project list',
    'projectmind project create --name "PaymentService" --workspace ws_123',
    'projectmind project init',
    'projectmind project status',
    'projectmind project attach repo_backend --workspace ws_123',
    'projectmind project archive proj_456',
  ];

  private readonly projectService: ProjectService;
  private readonly workspaceService: WorkspaceService;

  constructor(projectService?: ProjectService, workspaceService?: WorkspaceService) {
    const repo = new PersistentWorkspaceProjectRepository();
    this.projectService = projectService ?? new ProjectService(repo, repo);
    this.workspaceService = workspaceService ?? new WorkspaceService(repo);
  }

  public async execute(ctx: CLIContext): Promise<CLIResult> {
    const action = ctx.args[0] ?? 'status';
    const targetId = ctx.args[1];

    // Determine target workspace ID
    const explicitWs = (ctx.options['workspace'] as string) ?? (ctx.options['ws'] as string);
    const resolvedContext = await this.projectService.resolveProjectContext({
      explicitWorkspaceId: explicitWs,
      explicitProjectId: targetId,
      repositoryPath: ctx.workspacePath,
    });

    const activeWorkspaceId = explicitWs ?? resolvedContext.workspaceId;

    switch (action) {
      case 'list': {
        const list = await this.projectService.listProjects(activeWorkspaceId);
        const data = {
          workspaceId: activeWorkspaceId,
          count: list.length,
          projects: list.map((p) => ({
            id: p.projectId,
            name: p.name,
            slug: p.slug,
            status: p.status,
            type: p.projectType,
            repositoriesCount: p.repositoryIds.length,
          })),
        };
        return createSuccessResult(
          this.name,
          data,
          list.length > 0 ? `Found ${list.length} project(s) in workspace '${activeWorkspaceId}'` : `No projects found in workspace '${activeWorkspaceId}'`
        );
      }

      case 'show': {
        const projId = targetId ?? resolvedContext.projectId;
        if (!projId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing project identifier. Usage: projectmind project show <project_id>'
          );
        }
        try {
          const project = await this.projectService.getProject(projId);
          const repos = await this.projectService.listRepositories(projId);
          return createSuccessResult(
            this.name,
            { ...project, attachedRepositories: repos },
            `Project '${project.name}' (${project.projectId})`
          );
        } catch {
          return createErrorResult(
            this.name,
            CLIExitCode.RESOURCE_NOT_FOUND,
            `Project '${projId}' was not found.`
          );
        }
      }

      case 'create': {
        const name = (ctx.options['name'] as string) ?? targetId;
        if (!name) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Project name is required. Usage: projectmind project create <name> [--workspace <ws_id>]'
          );
        }

        // Ensure parent workspace exists
        let wsId = activeWorkspaceId;
        try {
          await this.workspaceService.getWorkspace(wsId);
        } catch {
          const createdWs = await this.workspaceService.createWorkspace({
            name: `Workspace for ${name}`,
            slug: wsId,
          });
          wsId = createdWs.workspaceId;
        }

        const project = await this.projectService.createProject({
          workspaceId: wsId,
          name,
          projectType: (ctx.options['type'] as any) ?? 'SERVICE',
        });

        return createSuccessResult(
          this.name,
          project,
          `Project '${project.name}' created in workspace '${project.workspaceId}' with ID: ${project.projectId}`
        );
      }

      case 'init': {
        const repoName = path.basename(ctx.workspacePath);
        const projectName = (ctx.options['name'] as string) ?? repoName;

        // Ensure default workspace exists
        let wsId = activeWorkspaceId;
        try {
          await this.workspaceService.getWorkspace(wsId);
        } catch {
          const createdWs = await this.workspaceService.createWorkspace({
            name: 'Default Workspace',
            slug: 'default',
          });
          wsId = createdWs.workspaceId;
        }

        let project: any;
        try {
          project = await this.projectService.getProjectBySlug(wsId, projectName.toLowerCase());
        } catch {
          project = await this.projectService.createProject({
            workspaceId: wsId,
            name: projectName,
            primaryRepositoryId: repoName,
          });
        }

        await this.projectService.initializeProject(project.projectId);

        const data = {
          workspaceId: wsId,
          projectId: project.projectId,
          projectName: project.name,
          repositoryId: repoName,
          status: 'ACTIVE',
          initializedAt: new Date().toISOString(),
        };

        return createSuccessResult(
          this.name,
          data,
          `Project '${project.name}' initialized successfully in workspace '${wsId}'`
        );
      }

      case 'status': {
        const projId = targetId ?? resolvedContext.projectId;
        const project = await this.projectService.resolveProjectContext({
          explicitWorkspaceId: activeWorkspaceId,
          explicitProjectId: projId,
          repositoryPath: ctx.workspacePath,
        });

        const statusData = {
          workspaceId: project.workspaceId,
          projectId: project.projectId,
          repositoryId: project.repositoryId,
          status: 'ACTIVE',
          configurationVersion: project.configurationVersion,
          knowledgeVersion: project.knowledgeVersion,
          isolationEnforced: project.settings.security.enforceWorkspaceIsolation,
        };

        return createSuccessResult(
          this.name,
          statusData,
          `Project status: '${project.projectId}' in workspace '${project.workspaceId}' (Repo: ${project.repositoryId})`
        );
      }

      case 'archive': {
        const projId = targetId ?? resolvedContext.projectId;
        if (!projId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Project ID required. Usage: projectmind project archive <project_id>'
          );
        }
        const archived = await this.projectService.archiveProject(projId);
        return createSuccessResult(
          this.name,
          archived,
          `Project '${archived.name}' archived successfully.`
        );
      }

      case 'attach': {
        const repoId = (ctx.options['repo'] as string) ?? targetId;
        const projId = (ctx.options['project'] as string) ?? resolvedContext.projectId;

        if (!repoId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Repository ID is required. Usage: projectmind project attach <repo_id> [--project <project_id>]'
          );
        }

        const association = await this.projectService.attachRepository({
          projectId: projId,
          repositoryId: repoId,
          workspaceId: activeWorkspaceId,
          repositoryPath: ctx.workspacePath,
        });

        return createSuccessResult(
          this.name,
          association,
          `Repository '${repoId}' attached to project '${projId}' successfully.`
        );
      }

      case 'detach': {
        const repoId = (ctx.options['repo'] as string) ?? targetId;
        const projId = (ctx.options['project'] as string) ?? resolvedContext.projectId;

        if (!repoId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Repository ID is required. Usage: projectmind project detach <repo_id> [--project <project_id>]'
          );
        }

        await this.projectService.detachRepository(projId, repoId);
        return createSuccessResult(
          this.name,
          { projectId: projId, repositoryId: repoId },
          `Repository '${repoId}' detached from project '${projId}'.`
        );
      }

      default:
        return createErrorResult(
          this.name,
          CLIExitCode.INVALID_USAGE,
          `Unknown project action '${action}'. Valid actions: list, show, create, init, status, archive, attach, detach.`
        );
    }
  }
}
