import type { PluginManifest } from '../models/PluginManifest.js';
import type { PluginCompatibilityResult, PluginCompatibilityIssue } from '../models/PluginCompatibilityResult.js';

export class PluginCompatibilityChecker {
  public static readonly CURRENT_PROJECTMIND_VERSION = '0.9.8';

  /**
   * Simple semver compare: returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2.
   */
  public static compareSemver(v1: string, v2: string): number {
    const clean1 = v1.replace(/^[^0-9]*/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
    const clean2 = v2.replace(/^[^0-9]*/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < 3; i++) {
      const num1 = clean1[i] ?? 0;
      const num2 = clean2[i] ?? 0;
      if (num1 < num2) return -1;
      if (num1 > num2) return 1;
    }
    return 0;
  }

  public checkCompatibility(
    manifest: PluginManifest,
    targetVersion: string = PluginCompatibilityChecker.CURRENT_PROJECTMIND_VERSION
  ): PluginCompatibilityResult {
    const issues: PluginCompatibilityIssue[] = [];
    const missingCapabilities: string[] = [];
    const unsupportedContracts: string[] = [];

    // Check minimum version
    if (manifest.minimumProjectMindVersion) {
      if (PluginCompatibilityChecker.compareSemver(targetVersion, manifest.minimumProjectMindVersion) < 0) {
        issues.push({
          code: 'MIN_VERSION_NOT_MET',
          severity: 'ERROR',
          message: `Plugin requires minimum ProjectMind version ${manifest.minimumProjectMindVersion}, but target is ${targetVersion}.`,
        });
      }
    }

    // Check maximum version
    if (manifest.maximumCompatibleProjectMindVersion) {
      if (PluginCompatibilityChecker.compareSemver(targetVersion, manifest.maximumCompatibleProjectMindVersion) > 0) {
        issues.push({
          code: 'MAX_VERSION_EXCEEDED',
          severity: 'ERROR',
          message: `Plugin is only compatible up to ProjectMind version ${manifest.maximumCompatibleProjectMindVersion}, but target is ${targetVersion}.`,
        });
      }
    }

    // Check supported interfaces
    for (const iface of manifest.supportedInterfaces) {
      if (!['IPlugin', 'IContextProvider', 'IRetrievalProvider', 'IToolProvider'].includes(iface)) {
        unsupportedContracts.push(iface);
        issues.push({
          code: 'UNKNOWN_INTERFACE',
          severity: 'WARNING',
          message: `Interface '${iface}' is not natively recognized in this ProjectMind version.`,
        });
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'ERROR');

    return {
      compatible: !hasErrors,
      pluginId: manifest.pluginId,
      targetProjectMindVersion: targetVersion,
      checkedAt: new Date().toISOString(),
      issues,
      missingCapabilities,
      unsupportedContracts,
    };
  }
}
