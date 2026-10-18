import * as fs from 'fs';
import * as path from 'path';
import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult } from '../core/CLIResult.js';
import type { ProjectMindKernel } from '../../kernel/ProjectMindKernel.js';

export class InitCommand implements CLICommand {
  public readonly name = 'init';
  public readonly description = 'Initializes ProjectMind for the current repository or workspace.';
  public readonly usage = 'projectmind init [--name <repo_name>] [--force] [--json]';
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'name',
      description: 'Custom repository name to assign',
      hasValue: true,
    },
    {
      name: 'force',
      description: 'Re-initialize configuration if already present',
      hasValue: false,
    },
    {
      name: 'json',
      description: 'Output initialization result in JSON format',
      hasValue: false,
    },
  ];

  public async execute(ctxOrArgs: CLIContext | string[], maybeKernel?: ProjectMindKernel): Promise<any> {
    // Backward compatibility with legacy Command interface execute(args, kernel)
    if (Array.isArray(ctxOrArgs)) {
      const kernel = maybeKernel!;
      const workspacePath = kernel.workspaceManager.workspacePath;
      const configDir = path.join(workspacePath, '.projectmind');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      const configPath = path.join(configDir, 'config.json');
      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(
          configPath,
          JSON.stringify(
            {
              version: '1.0.0',
              repository: path.basename(workspacePath),
            },
            null,
            2
          )
        );
      }
      return;
    }

    const ctx = ctxOrArgs;
    const workspacePath = ctx.workspacePath;
    const repoName = (ctx.options['name'] as string) ?? path.basename(workspacePath);
    const force = Boolean(ctx.options['force']);
    const configDir = path.join(workspacePath, '.projectmind');

    let alreadyInitialized = false;
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const configPath = path.join(configDir, 'config.json');
    if (fs.existsSync(configPath) && !force) {
      alreadyInitialized = true;
    } else {
      const configPayload = {
        version: '1.0.0',
        repository: repoName,
        initializedAt: new Date().toISOString(),
        featuresEnabled: true,
      };
      fs.writeFileSync(configPath, JSON.stringify(configPayload, null, 2));
    }

    // Initialize workspace via kernel
    const kernel = await ctx.getKernel();
    const isWorkspaceValid = kernel.workspaceManager.workspacePath !== undefined;

    const data = {
      workspacePath,
      repositoryName: repoName,
      configPath,
      alreadyInitialized,
      workspaceValid: isWorkspaceValid,
      status: 'INITIALIZED',
    };

    const message = alreadyInitialized
      ? `ProjectMind is already initialized in ${workspacePath}`
      : `ProjectMind initialized successfully for repository '${repoName}'`;

    return createSuccessResult(this.name, data, message);
  }
}
