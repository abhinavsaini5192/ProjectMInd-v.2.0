import type { ProjectMindKernel } from '../kernel/ProjectMindKernel.js';

export interface Command {
  name: string;
  description: string;
  execute(args: string[], kernel: ProjectMindKernel): Promise<void>;
}

/**
 * Legacy router maintained for backward compatibility.
 * Modern CLI execution uses CLIApplication.
 */
export class CommandRouter {
  private commands: Map<string, Command> = new Map();

  public register(command: Command): void {
    this.commands.set(command.name, command);
  }

  public async route(args: string[], kernel: ProjectMindKernel): Promise<void> {
    const commandName = args[0];

    if (!commandName || commandName === 'help') {
      this.printHelp();
      return;
    }

    const command = this.commands.get(commandName);

    if (command) {
      await command.execute(args.slice(1), kernel);
    } else {
      console.error(`Unknown command: ${commandName}`);
      this.printHelp();
    }
  }

  public printHelp(): void {
    console.log(`\nProjectMind CLI\n\nUsage: projectmind <command> [args]\n\nCommands:`);
    for (const cmd of this.commands.values()) {
      console.log(`  ${cmd.name.padEnd(15)} ${cmd.description}`);
    }
    console.log('');
  }
}
