import type { CLIExitCode } from './CLIExitCode.js';

/**
 * Standard Result Envelope for CLI commands.
 * Guaranteed format for both machine-readable JSON output and structured text rendering.
 */
export interface CLIResult<T = unknown> {
  readonly success: boolean;
  readonly command: string;
  readonly exitCode: CLIExitCode;
  readonly data?: T | undefined;
  readonly message?: string | undefined;
  readonly warnings?: readonly string[] | undefined;
  readonly errors?: readonly string[] | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export function createSuccessResult<T>(
  commandOrData: string | T,
  dataOrMessage?: T | string,
  message?: string,
  warnings?: string[],
  metadata?: Record<string, unknown>
): CLIResult<T> {
  if (typeof commandOrData === 'string' && (typeof dataOrMessage !== 'string' || message !== undefined)) {
    return {
      success: true,
      command: commandOrData,
      exitCode: 0 as CLIExitCode,
      data: dataOrMessage as T,
      message,
      warnings,
      metadata,
    };
  }

  return {
    success: true,
    command: 'cli',
    exitCode: 0 as CLIExitCode,
    data: commandOrData as T,
    message: typeof dataOrMessage === 'string' ? dataOrMessage : undefined,
    warnings,
    metadata,
  };
}

export function createErrorResult(
  commandOrMessage: string,
  exitCodeOrMessage?: CLIExitCode | string,
  messageOrErrors?: string | string[],
  errors?: string[],
  warnings?: string[],
  metadata?: Record<string, unknown>
): CLIResult<never> {
  if (typeof exitCodeOrMessage === 'number' && typeof messageOrErrors !== 'string') {
    const msg = commandOrMessage;
    const code = exitCodeOrMessage as CLIExitCode;
    return {
      success: false,
      command: 'cli',
      exitCode: code,
      message: msg,
      errors: Array.isArray(messageOrErrors) ? messageOrErrors : [msg],
      warnings,
      metadata,
    };
  }

  const cmd = commandOrMessage;
  const code = (typeof exitCodeOrMessage === 'number' ? exitCodeOrMessage : 1) as CLIExitCode;
  const msg = typeof messageOrErrors === 'string' ? messageOrErrors : (typeof exitCodeOrMessage === 'string' ? exitCodeOrMessage : 'Unknown error');
  return {
    success: false,
    command: cmd,
    exitCode: code,
    message: msg,
    errors: errors ?? [msg],
    warnings,
    metadata,
  };
}
