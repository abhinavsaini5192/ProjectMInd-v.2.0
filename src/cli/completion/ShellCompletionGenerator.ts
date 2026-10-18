import type { CommandRegistry } from '../core/CommandRegistry.js';

export type SupportedShell = 'bash' | 'zsh' | 'fish' | 'powershell';

export class ShellCompletionGenerator {
  constructor(private readonly registry: CommandRegistry) {}

  public generate(shell: SupportedShell): string {
    switch (shell) {
      case 'bash':
        return this.generateBash();
      case 'zsh':
        return this.generateZsh();
      case 'fish':
        return this.generateFish();
      case 'powershell':
        return this.generatePowerShell();
      default:
        throw new Error(`Unsupported shell: ${String(shell)}`);
    }
  }

  private generateBash(): string {
    const commands = this.registry.getAll();
    const commandNames = commands.map((c) => c.name).join(' ');

    const caseBranches = commands
      .map((c) => {
        const flags = (c.options ?? [])
          .map((o) => `--${o.name}${o.alias ? ` -${o.alias}` : ''}`)
          .concat(['--json', '--verbose', '--debug', '--help'])
          .join(' ');
        return `    ${c.name})\n      COMPREPLY=( $(compgen -W "${flags}" -- "\${cur}") )\n      return 0\n      ;;`;
      })
      .join('\n');

    return `# ProjectMind Bash Completion
_projectmind_completions()
{
  local cur prev words cword
  _init_completion || return

  local commands="${commandNames}"
  local global_flags="--json --verbose --debug --help --version"

  if [ "\${cword}" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands} \${global_flags}" -- "\${cur}") )
    return 0
  fi

  case "\${words[1]}" in
${caseBranches}
    *)
      ;;
  esac
}

complete -F _projectmind_completions projectmind
`;
  }

  private generateZsh(): string {
    const commands = this.registry.getAll();
    const commandList = commands
      .map((c) => `    "${c.name}:${c.description.replace(/"/g, '\\"')}"`)
      .join('\n');

    return `#compdef projectmind

_projectmind() {
  local line state

  _arguments -C \\
    "1: :->command" \\
    "*::arg:->args"

  case $state in
    command)
      local -a subcommands
      subcommands=(
${commandList}
      )
      _describe 'command' subcommands
      ;;
    args)
      case $words[1] in
        *)
          _arguments \\
            '--json[Format output as machine-readable JSON]' \\
            '--verbose[Enable verbose output]' \\
            '--debug[Enable debug mode]' \\
            '--help[Show help]'
          ;;
      esac
      ;;
  esac
}

_projectmind "$@"
`;
  }

  private generateFish(): string {
    const commands = this.registry.getAll();
    const lines = [
      '# ProjectMind Fish Completion',
      'complete -c projectmind -f',
    ];

    for (const cmd of commands) {
      lines.push(
        `complete -c projectmind -n "__fish_use_subcommand" -a "${cmd.name}" -d "${cmd.description.replace(/"/g, '\\"')}"`
      );
      if (cmd.options) {
        for (const opt of cmd.options) {
          const shortFlag = opt.alias ? `-s ${opt.alias}` : '';
          lines.push(
            `complete -c projectmind -n "__fish_seen_subcommand_from ${cmd.name}" -l ${opt.name} ${shortFlag} -d "${opt.description.replace(/"/g, '\\"')}"`
          );
        }
      }
    }

    lines.push('complete -c projectmind -l json -d "Output in JSON format"');
    lines.push('complete -c projectmind -l verbose -d "Enable verbose mode"');
    lines.push('complete -c projectmind -l debug -d "Enable debug mode"');
    lines.push('complete -c projectmind -l help -s h -d "Display help"');
    lines.push('complete -c projectmind -l version -s v -d "Display version"');

    return lines.join('\n') + '\n';
  }

  private generatePowerShell(): string {
    const commands = this.registry.getAll();
    const commandList = commands.map((c) => `'${c.name}'`).join(', ');

    return `# ProjectMind PowerShell Completion
Register-ArgumentCompleter -Native -CommandName projectmind -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commandElements = $commandAst.CommandElements
    $commands = @(${commandList})

    if ($commandElements.Count -le 2) {
        $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
        }
    } else {
        $flags = @('--json', '--verbose', '--debug', '--help', '--version')
        $flags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
        }
    }
}
`;
  }
}
