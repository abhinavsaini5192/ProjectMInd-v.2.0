export class PluginError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(message: string, code: string = 'PLUGIN_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.name = 'PluginError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ManifestValidationError extends PluginError {
  public readonly validationErrors: readonly string[];

  constructor(message: string, validationErrors: readonly string[] = []) {
    super(message, 'MANIFEST_VALIDATION_ERROR', { validationErrors });
    this.name = 'ManifestValidationError';
    this.validationErrors = validationErrors;
  }
}

export class PluginIncompatibleError extends PluginError {
  public readonly pluginId: string;
  public readonly targetVersion: string;
  public readonly issues: readonly string[];

  constructor(pluginId: string, targetVersion: string, issues: readonly string[]) {
    super(
      `Plugin '${pluginId}' is incompatible with ProjectMind v${targetVersion}: ${issues.join('; ')}`,
      'PLUGIN_INCOMPATIBLE_ERROR',
      { pluginId, targetVersion, issues }
    );
    this.name = 'PluginIncompatibleError';
    this.pluginId = pluginId;
    this.targetVersion = targetVersion;
    this.issues = issues;
  }
}

export class PluginNotFoundError extends PluginError {
  public readonly pluginId: string;

  constructor(pluginId: string) {
    super(`Plugin '${pluginId}' was not found.`, 'PLUGIN_NOT_FOUND_ERROR', { pluginId });
    this.name = 'PluginNotFoundError';
    this.pluginId = pluginId;
  }
}

export class PluginSecurityError extends PluginError {
  public readonly pluginId: string;
  public readonly missingCapabilities?: readonly string[] | undefined;
  public readonly missingPermissions?: readonly string[] | undefined;

  constructor(
    pluginId: string,
    message: string,
    missingCapabilities?: readonly string[],
    missingPermissions?: readonly string[]
  ) {
    super(message, 'PLUGIN_SECURITY_ERROR', { pluginId, missingCapabilities, missingPermissions });
    this.name = 'PluginSecurityError';
    this.pluginId = pluginId;
    this.missingCapabilities = missingCapabilities;
    this.missingPermissions = missingPermissions;
  }
}

export class PluginLifecycleError extends PluginError {
  public readonly pluginId: string;
  public readonly currentState: string;
  public readonly attemptedState: string;

  constructor(pluginId: string, currentState: string, attemptedState: string, reason?: string) {
    super(
      `Illegal lifecycle transition for plugin '${pluginId}': cannot transition from ${currentState} to ${attemptedState}${
        reason ? ` (${reason})` : ''
      }`,
      'PLUGIN_LIFECYCLE_ERROR',
      { pluginId, currentState, attemptedState, reason }
    );
    this.name = 'PluginLifecycleError';
    this.pluginId = pluginId;
    this.currentState = currentState;
    this.attemptedState = attemptedState;
  }
}

export class PluginExecutionError extends PluginError {
  public readonly pluginId: string;
  public readonly operation: string;

  constructor(pluginId: string, operation: string, message: string, details?: Record<string, unknown>) {
    super(
      `Execution failed for plugin '${pluginId}' operation '${operation}': ${message}`,
      'PLUGIN_EXECUTION_ERROR',
      { pluginId, operation, ...details }
    );
    this.name = 'PluginExecutionError';
    this.pluginId = pluginId;
    this.operation = operation;
  }
}

export class PluginTimeoutError extends PluginError {
  public readonly pluginId: string;
  public readonly operation: string;
  public readonly timeoutMs: number;

  constructor(pluginId: string, operation: string, timeoutMs: number) {
    super(
      `Operation '${operation}' on plugin '${pluginId}' timed out after ${timeoutMs}ms.`,
      'PLUGIN_TIMEOUT_ERROR',
      { pluginId, operation, timeoutMs }
    );
    this.name = 'PluginTimeoutError';
    this.pluginId = pluginId;
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

export class PluginDependencyError extends PluginError {
  public readonly pluginId: string;
  public readonly missingDependencies: readonly string[];
  public readonly dependencyCycle?: readonly string[] | undefined;

  constructor(
    pluginId: string,
    message: string,
    missingDependencies: readonly string[] = [],
    dependencyCycle?: readonly string[]
  ) {
    super(message, 'PLUGIN_DEPENDENCY_ERROR', { pluginId, missingDependencies, dependencyCycle });
    this.name = 'PluginDependencyError';
    this.pluginId = pluginId;
    this.missingDependencies = missingDependencies;
    this.dependencyCycle = dependencyCycle;
  }
}
