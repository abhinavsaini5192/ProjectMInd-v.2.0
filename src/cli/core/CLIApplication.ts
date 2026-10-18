import { CommandRegistry } from './CommandRegistry.js';
import type { CLICommand } from './CLICommand.js';
import { CLIContext, type OutputFormat } from './CLIContext.js';
import { type CLIResult, createErrorResult } from './CLIResult.js';
import { CLIExitCode } from './CLIExitCode.js';
import { CLIOutputFormatter } from '../output/CLIOutputFormatter.js';
import { CLIErrorHandler } from '../errors/CLIErrorHandler.js';

// Core Commands
import { InitCommand } from '../commands/InitCommand.js';
import { StatusCommand } from '../commands/StatusCommand.js';
import { AnalyzeCommand } from '../commands/AnalyzeCommand.js';
import { ContextCommand } from '../commands/ContextCommand.js';
import { FeatureCommand } from '../commands/FeatureCommand.js';
import { ImpactCommand } from '../commands/ImpactCommand.js';
import { HistoryCommand } from '../commands/HistoryCommand.js';
import { HealthCommand } from '../commands/HealthCommand.js';
import { UpdateCommand } from '../commands/UpdateCommand.js';
import { InspectCommand } from '../commands/InspectCommand.js';
import { DoctorCommand } from '../commands/DoctorCommand.js';
import { VersionCommand } from '../commands/VersionCommand.js';
import { HelpCommand } from '../commands/HelpCommand.js';
import { CompletionCommand } from '../commands/CompletionCommand.js';
import { WorkspaceCommand } from '../commands/WorkspaceCommand.js';
import { ProjectCommand } from '../commands/ProjectCommand.js';
import { SearchCommand } from '../commands/SearchCommand.js';
import { MemoryCommand } from '../commands/MemoryCommand.js';
import { CollaborationCommand } from '../commands/CollaborationCommand.js';
import { PlanCommand } from '../commands/PlanCommand.js';
import { FeedbackCommand } from '../commands/FeedbackCommand.js';
import { LearningCommand } from '../commands/LearningCommand.js';

// Legacy / Extension Commands
import { PluginCommand } from '../commands/PluginCommand.js';
import { AnalyticsCommand } from '../commands/AnalyticsCommand.js';
import { BenchmarkCommand } from '../commands/BenchmarkCommand.js';
import { CompatibilityCommand } from '../commands/CompatibilityCommand.js';
import { BackupCommand } from '../commands/BackupCommand.js';
import { PersistentWorkspaceProjectRepository } from '../../workspace/persistence/PersistentWorkspaceProjectRepository.js';
import { WorkspaceService } from '../../workspace/services/WorkspaceService.js';
import { ProjectService } from '../../workspace/services/ProjectService.js';

export interface ParsedArgs {
  readonly commandName?: string | undefined;
  readonly args: readonly string[];
  readonly options: Record<string, string | boolean | number>;
  readonly format: OutputFormat;
  readonly isHelp: boolean;
  readonly isVersion: boolean;
  readonly isVerbose: boolean;
  readonly isDebug: boolean;
  readonly workspacePath?: string | undefined;
  readonly noTelemetry: boolean;
}

export interface CLIApplicationOptions {
  readonly registry?: CommandRegistry | undefined;
  readonly stdout?: ((msg: string) => unknown) | undefined;
  readonly stderr?: ((msg: string) => unknown) | undefined;
}

export class CLIApplication {
  public readonly registry: CommandRegistry;
  private readonly stdout: (msg: string) => void;
  private readonly stderr: (msg: string) => void;

  constructor(options: CLIApplicationOptions = {}) {
    this.registry = options.registry ?? new CommandRegistry();
    this.stdout = options.stdout ?? ((msg: string) => process.stdout.write(msg + '\n'));
    this.stderr = options.stderr ?? ((msg: string) => process.stderr.write(msg + '\n'));
  }

  /**
   * Factory creating a fully-configured CLIApplication instance with all standard commands.
   */
  public static createDefault(options: CLIApplicationOptions = {}): CLIApplication {
    const app = new CLIApplication(options);

    // Register primary Phase 9.1 command suite
    app.register(new VersionCommand());
    app.register(new InitCommand());
    app.register(new StatusCommand());
    app.register(new AnalyzeCommand());
    app.register(new ContextCommand());
    app.register(new FeatureCommand());
    app.register(new ImpactCommand());
    app.register(new HistoryCommand());
    app.register(new HealthCommand());
    app.register(new UpdateCommand());
    app.register(new InspectCommand());
    app.register(new DoctorCommand());
    app.register(new CompletionCommand(app.registry));
    app.register(new HelpCommand(app.registry));

    // Phase 9.2 Workspace & Project Management Commands
    const sharedWorkspaceProjectRepo = new PersistentWorkspaceProjectRepository();
    const sharedWorkspaceService = new WorkspaceService(sharedWorkspaceProjectRepo);
    const sharedProjectService = new ProjectService(sharedWorkspaceProjectRepo, sharedWorkspaceProjectRepo);

    app.register(new WorkspaceCommand(sharedWorkspaceService));
    app.register(new ProjectCommand(sharedProjectService, sharedWorkspaceService));

    // Phase 9.4 Semantic Retrieval & Project Memory Commands
    app.register(new SearchCommand());
    app.register(new MemoryCommand());

    // Phase 9.5 Multi-Agent Collaboration Commands
    app.register(new CollaborationCommand());

    // Phase 9.6 Task Planning & Execution Orchestration Commands
    app.register(new PlanCommand());

    // Phase 9.7 Learning & Feedback Intelligence Commands
    app.register(new FeedbackCommand());
    app.register(new LearningCommand());

    // Register backward compatibility and platform extension commands
    app.register(new PluginCommand());
    app.register(new AnalyticsCommand());
    app.register(new BenchmarkCommand());
    app.register(new CompatibilityCommand());
    app.register(new BackupCommand());

    return app;
  }

  public register(command: CLICommand): void {
    this.registry.register(command);
  }

  /**
   * Main entry point to run CLI with argument strings.
   * Returns standard exit code (0 for success).
   */
  public async run(rawArgs: readonly string[]): Promise<number> {
    const parsed = this.parseArgs(rawArgs);
    const startTime = Date.now();

    // Fast-path: Version flag
    if (parsed.isVersion && !parsed.commandName) {
      const verCmd = this.registry.get('version');
      if (verCmd) {
        return this.executeCommand(verCmd, parsed, startTime);
      }
    }

    // Fast-path: Global help or empty command
    if (!parsed.commandName || (parsed.isHelp && !parsed.commandName)) {
      const helpCmd = this.registry.get('help');
      if (helpCmd) {
        return this.executeCommand(helpCmd, parsed, startTime);
      }
    }

    // Resolve target command
    const targetCommand = this.registry.get(parsed.commandName!);
    if (!targetCommand) {
      const notFoundResult = createErrorResult(
        parsed.commandName ?? 'unknown',
        CLIExitCode.INVALID_USAGE,
        `Unknown command '${parsed.commandName}'. Run 'projectmind help' to view available commands.`,
        [`Command '${parsed.commandName}' does not exist.`]
      );
      this.emitResult(notFoundResult, parsed.format);
      return CLIExitCode.INVALID_USAGE;
    }

    // If --help flag provided with command (e.g. projectmind status --help)
    if (parsed.isHelp) {
      const helpCmd = this.registry.get('help');
      if (helpCmd) {
        const helpParsed: ParsedArgs = {
          ...parsed,
          args: [targetCommand.name],
          isHelp: false,
        };
        return this.executeCommand(helpCmd, helpParsed, startTime);
      }
    }

    return this.executeCommand(targetCommand, parsed, startTime);
  }

  private async executeCommand(
    command: CLICommand,
    parsed: ParsedArgs,
    startTime: number
  ): Promise<number> {
    const ctx = new CLIContext({
      workspacePath: parsed.workspacePath,
      args: parsed.args,
      options: parsed.options,
      format: parsed.format,
      isVerbose: parsed.isVerbose,
      isDebug: parsed.isDebug,
      stdout: this.stdout,
      stderr: this.stderr,
    });

    let result: CLIResult;

    try {
      result = await command.execute(ctx);
    } catch (err: unknown) {
      result = CLIErrorHandler.handleError(command.name, err, parsed.isDebug);
    } finally {
      // Clean disposal of lazy kernel / platform connections
      await ctx.dispose();
    }

    const durationMs = Date.now() - startTime;

    // Attach execution metadata
    result = {
      ...result,
      metadata: {
        ...(result.metadata ?? {}),
        durationMs,
      },
    };

    // Telemetry reporting (without recording private data or secrets)
    if (!parsed.noTelemetry) {
      this.recordTelemetry({
        command: command.name,
        durationMs,
        success: result.success,
        exitCode: result.exitCode,
      });
    }

    this.emitResult(result, parsed.format);
    return result.exitCode;
  }

  private emitResult(result: CLIResult, format: OutputFormat): void {
    const formatted = CLIOutputFormatter.format(result, format);
    if (result.success) {
      this.stdout(formatted);
    } else {
      this.stderr(formatted);
    }
  }

  private recordTelemetry(data: {
    command: string;
    durationMs: number;
    success: boolean;
    exitCode: number;
  }): void {
    // In-memory / background telemetry hook compliant with Phase 8.5 Observability
    // Note: No source code, passwords, or tokens are ever collected.
  }

  public parseArgs(rawArgs: readonly string[]): ParsedArgs {
    let commandName: string | undefined;
    const args: string[] = [];
    const options: Record<string, string | boolean | number> = {};
    let isHelp = false;
    let isVersion = false;
    let isVerbose = false;
    let isDebug = false;
    let format: OutputFormat = 'text';
    let workspacePath: string | undefined;
    let noTelemetry = false;

    let i = 0;
    while (i < rawArgs.length) {
      const arg = rawArgs[i]!;

      if (arg === '--help' || arg === '-h') {
        isHelp = true;
        options['help'] = true;
      } else if (arg === '--version' || arg === '-v') {
        isVersion = true;
        options['version'] = true;
      } else if (arg === '--json') {
        format = 'json';
        options['json'] = true;
      } else if (arg === '--text') {
        format = 'text';
        options['text'] = true;
      } else if (arg === '--table') {
        format = 'table';
        options['table'] = true;
      } else if (arg === '--verbose') {
        isVerbose = true;
        options['verbose'] = true;
      } else if (arg === '--debug') {
        isDebug = true;
        options['debug'] = true;
      } else if (arg === '--no-telemetry') {
        noTelemetry = true;
        options['no-telemetry'] = true;
      } else if (arg === '--workspace' || arg === '-w') {
        i++;
        if (i < rawArgs.length) {
          workspacePath = rawArgs[i];
          options['workspace'] = rawArgs[i]!;
        }
      } else if (arg.startsWith('--workspace=')) {
        workspacePath = arg.substring('--workspace='.length);
        options['workspace'] = workspacePath;
      } else if (arg.startsWith('--')) {
        const flagBody = arg.substring(2);
        if (flagBody.includes('=')) {
          const [key, val] = flagBody.split('=');
          if (key && val !== undefined) {
            options[key] = val;
          }
        } else {
          // Check if next arg is value
          const nextArg = rawArgs[i + 1];
          if (nextArg && !nextArg.startsWith('-')) {
            options[flagBody] = nextArg;
            i++;
          } else {
            options[flagBody] = true;
          }
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        // Short flags
        const flag = arg.substring(1);
        options[flag] = true;
      } else {
        // Positional argument
        if (!commandName) {
          commandName = arg;
        } else {
          args.push(arg);
        }
      }

      i++;
    }

    return {
      commandName,
      args,
      options,
      format,
      isHelp,
      isVersion,
      isVerbose,
      isDebug,
      workspacePath,
      noTelemetry,
    };
  }
}
