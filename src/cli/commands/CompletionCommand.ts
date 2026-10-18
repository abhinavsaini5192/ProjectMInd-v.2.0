import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import type { CommandRegistry } from '../core/CommandRegistry.js';
import { ShellCompletionGenerator, type SupportedShell } from '../completion/ShellCompletionGenerator.js';

export class CompletionCommand implements CLICommand {
  public readonly name = 'completion';
  public readonly description = 'Generates shell autocompletion scripts for bash, zsh, fish, or powershell.';
  public readonly usage = 'projectmind completion <bash|zsh|fish|powershell> [--json]';
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'json',
      description: 'Output completion script wrapped in JSON metadata',
      hasValue: false,
    },
  ];
  public readonly examples = [
    'projectmind completion bash > /etc/bash_completion.d/projectmind',
    'projectmind completion zsh > "${fpath[1]}/_projectmind"',
    'projectmind completion fish > ~/.config/fish/completions/projectmind.fish',
    'projectmind completion powershell | Out-String | Invoke-Expression',
  ];

  constructor(private readonly registry?: CommandRegistry) {}

  public async execute(ctx: CLIContext): Promise<CLIResult> {
    const shell = ctx.args[0]?.toLowerCase() as SupportedShell | undefined;
    const validShells: SupportedShell[] = ['bash', 'zsh', 'fish', 'powershell'];

    if (!shell || !validShells.includes(shell)) {
      return createErrorResult(
        this.name,
        CLIExitCode.INVALID_USAGE,
        `Invalid or missing shell argument. Supported shells: ${validShells.join(', ')}`,
        [`Received: '${String(shell)}'. Please specify one of: ${validShells.join(', ')}.`]
      );
    }

    if (!this.registry) {
      return createErrorResult(
        this.name,
        CLIExitCode.INTERNAL_ERROR,
        'Command registry is not bound to CompletionCommand'
      );
    }

    const generator = new ShellCompletionGenerator(this.registry);
    const script = generator.generate(shell);

    const data = {
      shell,
      instructions: `Source or install this script in your ${shell} profile to enable autocompletion.`,
      script,
    };

    return createSuccessResult(
      this.name,
      data,
      script // In text mode, this will output the raw completion script directly
    );
  }
}
