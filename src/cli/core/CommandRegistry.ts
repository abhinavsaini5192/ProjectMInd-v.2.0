import type { CLICommand } from './CLICommand.js';

export class CommandRegistry {
  private readonly commands = new Map<string, CLICommand>();
  private readonly aliasMap = new Map<string, string>();

  public register(command: CLICommand): void {
    this.commands.set(command.name, command);

    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliasMap.set(alias, command.name);
      }
    }
  }

  public get(nameOrAlias: string): CLICommand | undefined {
    const canonicalName = this.aliasMap.get(nameOrAlias) ?? nameOrAlias;
    return this.commands.get(canonicalName);
  }

  public has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== undefined;
  }

  public getAll(): readonly CLICommand[] {
    return Array.from(this.commands.values());
  }

  public getNames(): readonly string[] {
    return Array.from(this.commands.keys());
  }
}
