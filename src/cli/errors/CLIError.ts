import { CLIExitCode } from '../core/CLIExitCode.js';

export class CLIError extends Error {
  public readonly exitCode: CLIExitCode;
  public readonly category: string;
  public readonly suggestions: readonly string[];

  constructor(
    message: string,
    options: {
      exitCode?: CLIExitCode | undefined;
      category?: string | undefined;
      suggestions?: readonly string[] | undefined;
      cause?: unknown | undefined;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'CLIError';
    this.exitCode = options.exitCode ?? CLIExitCode.GENERAL_FAILURE;
    this.category = options.category ?? 'GENERAL';
    this.suggestions = options.suggestions ?? [];
  }
}
