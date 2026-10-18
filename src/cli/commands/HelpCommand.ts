import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import type { CommandRegistry } from '../core/CommandRegistry.js';

export class HelpCommand implements CLICommand {
  public readonly name = 'help';
  public readonly description = 'Displays help and usage instructions for ProjectMind commands.';
  public readonly usage = 'projectmind help [command] [--json]';
  public readonly aliases = ['--help', '-h'];
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'json',
      description: 'Output help documentation in JSON format',
      hasValue: false,
    },
  ];

  constructor(private readonly registry?: CommandRegistry) {}

  public async execute(ctx: CLIContext): Promise<CLIResult> {
    const targetCommandName = ctx.args[0];

    if (targetCommandName && this.registry) {
      const cmd = this.registry.get(targetCommandName);
      if (!cmd) {
        return createErrorResult(
          this.name,
          CLIExitCode.INVALID_USAGE,
          `Unknown command '${targetCommandName}'. Run 'projectmind help' to view available commands.`,
          [`Command '${targetCommandName}' is not registered.`]
        );
      }

      const commandHelpData = {
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage ?? `projectmind ${cmd.name} [options]`,
        aliases: cmd.aliases ?? [],
        options: cmd.options ?? [],
        examples: cmd.examples ?? [],
      };

      const lines: string[] = [
        `\x1b[1mCommand:\x1b[0m ${cmd.name}`,
        `\x1b[1mDescription:\x1b[0m ${cmd.description}`,
        `\x1b[1mUsage:\x1b[0m ${commandHelpData.usage}`,
      ];

      if (cmd.aliases && cmd.aliases.length > 0) {
        lines.push(`\x1b[1mAliases:\x1b[0m ${cmd.aliases.join(', ')}`);
      }

      if (cmd.options && cmd.options.length > 0) {
        lines.push('');
        lines.push('\x1b[1mOptions:\x1b[0m');
        for (const opt of cmd.options) {
          const aliasStr = opt.alias ? `-${opt.alias}, ` : '    ';
          const flagStr = `--${opt.name}`.padEnd(20);
          lines.push(`  ${aliasStr}${flagStr} ${opt.description}`);
        }
      }

      if (cmd.examples && cmd.examples.length > 0) {
        lines.push('');
        lines.push('\x1b[1mExamples:\x1b[0m');
        for (const ex of cmd.examples) {
          lines.push(`  $ ${ex}`);
        }
      }

      return createSuccessResult(
        this.name,
        commandHelpData,
        lines.join('\n')
      );
    }

    // Global help
    const commands = this.registry ? this.registry.getAll() : [];
    const globalHelpData = {
      title: 'ProjectMind CLI',
      description: 'AI-Native Software Engineering Intelligence Platform CLI',
      usage: 'projectmind <command> [options] [args]',
      globalOptions: [
        { name: 'json', description: 'Format output as machine-readable JSON' },
        { name: 'verbose', description: 'Enable verbose logging and extra diagnostics' },
        { name: 'debug', description: 'Enable debug mode with full error traces' },
        { name: 'help', description: 'Show command help' },
        { name: 'version', description: 'Show platform and CLI version' },
      ],
      commands: commands.map((c) => ({
        name: c.name,
        description: c.description,
        usage: c.usage,
      })),
    };

    const lines: string[] = [
      '\x1b[1mProjectMind CLI\x1b[0m — AI-Native Repository Intelligence Platform',
      '',
      '\x1b[1mUsage:\x1b[0m projectmind <command> [options] [arguments]',
      '',
      '\x1b[1mAvailable Commands:\x1b[0m',
    ];

    for (const cmd of commands) {
      lines.push(`  ${cmd.name.padEnd(16)} ${cmd.description}`);
    }

    lines.push('');
    lines.push('\x1b[1mGlobal Options:\x1b[0m');
    lines.push('  --json           Format output as machine-readable JSON');
    lines.push('  --verbose        Enable verbose output with metadata');
    lines.push('  --debug          Display diagnostic error details and stack traces');
    lines.push('  -h, --help       Display help information');
    lines.push('  -v, --version    Display ProjectMind version');
    lines.push('');
    lines.push("Run 'projectmind help <command>' or 'projectmind <command> --help' for details on a specific command.");

    return createSuccessResult(
      this.name,
      globalHelpData,
      lines.join('\n')
    );
  }
}
