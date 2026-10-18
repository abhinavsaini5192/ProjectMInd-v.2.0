import type { CLIContext } from './CLIContext.js';
import type { CLIResult } from './CLIResult.js';

export interface CLICommandOption {
  readonly name: string;
  readonly alias?: string | undefined;
  readonly description: string;
  readonly type?: string | undefined;
  readonly hasValue?: boolean | undefined;
  readonly defaultValue?: string | boolean | number | undefined;
}

export interface CLICommandHelp {
  readonly summary?: string | undefined;
  readonly usage?: string | undefined;
  readonly examples?: readonly string[] | undefined;
  readonly subcommands?: readonly { readonly name: string; readonly description: string }[] | Record<string, string> | undefined;
  readonly options?: readonly CLICommandOption[] | undefined;
}

export interface CLICommand {
  readonly name: string;
  readonly description: string;
  readonly usage?: string | undefined;
  readonly aliases?: readonly string[] | undefined;
  readonly options?: readonly CLICommandOption[] | undefined;
  readonly examples?: readonly string[] | undefined;
  readonly help?: CLICommandHelp | undefined;

  execute(ctx: CLIContext): Promise<CLIResult>;
}
