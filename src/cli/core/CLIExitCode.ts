/**
 * Canonical CLI Exit Codes for ProjectMind.
 * Provides deterministic, stable process exit codes for scripts, CI/CD, and developer tooling.
 */
export enum CLIExitCode {
  SUCCESS = 0,
  GENERAL_FAILURE = 1,
  GENERAL_ERROR = 1,
  EXECUTION_ERROR = 1,
  INVALID_USAGE = 2,
  INVALID_ARGUMENT = 2,
  INVALID_ARGUMENTS = 2,
  CONFIG_FAILURE = 3,
  AUTH_FAILURE = 4,
  FORBIDDEN_SCOPE = 5,
  RESOURCE_NOT_FOUND = 6,
  NOT_FOUND = 6,
  SERVICE_UNAVAILABLE = 7,
  STALE_CONFLICT = 8,
  VERIFICATION_FAILURE = 9,
  INTERNAL_ERROR = 10,
}
