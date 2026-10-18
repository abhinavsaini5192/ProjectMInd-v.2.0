import { CLIExitCode } from '../core/CLIExitCode.js';
import { type CLIResult, createErrorResult } from '../core/CLIResult.js';
import { CLIError } from './CLIError.js';
import { LogRedactor } from '../../platform/logging/LogRedactor.js';

export class CLIErrorHandler {
  public static handleError(commandName: string, error: unknown, isDebug = false): CLIResult<never> {
    if (error instanceof CLIError) {
      return createErrorResult(
        commandName,
        error.exitCode,
        error.message,
        [error.message],
        error.suggestions.map((s) => `Suggestion: ${s}`),
        { category: error.category }
      );
    }

    const rawMessage = error instanceof Error ? error.message : String(error);
    const sanitizedMessage = LogRedactor.redactString(rawMessage);
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    let exitCode = CLIExitCode.GENERAL_FAILURE;
    const warnings: string[] = [];

    // Map domain error names to specific CLI exit codes
    if (errorName.includes('Config')) {
      exitCode = CLIExitCode.CONFIG_FAILURE;
      warnings.push('Check .env or configuration files for missing or invalid parameters.');
    } else if (errorName.includes('Auth') || errorName.includes('Credential')) {
      exitCode = CLIExitCode.AUTH_FAILURE;
      warnings.push('Ensure valid credentials or PROJECTMIND_SECRET_KEY are supplied.');
    } else if (errorName.includes('Scope') || errorName.includes('Forbidden') || errorName.includes('Permission')) {
      exitCode = CLIExitCode.FORBIDDEN_SCOPE;
      warnings.push('Verify current workspaceId and repositoryId access permissions.');
    } else if (errorName.includes('NotFound')) {
      exitCode = CLIExitCode.RESOURCE_NOT_FOUND;
    } else if (errorName.includes('Unavailable') || errorName.includes('Timeout')) {
      exitCode = CLIExitCode.SERVICE_UNAVAILABLE;
      warnings.push('Check platform service health and database availability.');
    } else if (errorName.includes('Conflict') || errorName.includes('Stale')) {
      exitCode = CLIExitCode.STALE_CONFLICT;
      warnings.push('Refresh context or re-run knowledge update to resolve conflicts.');
    } else if (errorName.includes('Verification')) {
      exitCode = CLIExitCode.VERIFICATION_FAILURE;
    } else if (errorName.includes('Fatal')) {
      exitCode = CLIExitCode.INTERNAL_ERROR;
    }

    const metadata: Record<string, unknown> = {
      errorType: errorName,
    };

    if (isDebug && error instanceof Error && error.stack) {
      metadata['stack'] = LogRedactor.redactString(error.stack);
    }

    return createErrorResult(
      commandName,
      exitCode,
      sanitizedMessage,
      [sanitizedMessage],
      warnings.length > 0 ? warnings : undefined,
      metadata
    );
  }
}
