export interface PluginCompatibilityIssue {
  readonly code: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}

export interface PluginCompatibilityResult {
  readonly compatible: boolean;
  readonly pluginId: string;
  readonly targetProjectMindVersion: string;
  readonly checkedAt: string;
  readonly issues: readonly PluginCompatibilityIssue[];
  readonly missingCapabilities: readonly string[];
  readonly unsupportedContracts: readonly string[];
}
