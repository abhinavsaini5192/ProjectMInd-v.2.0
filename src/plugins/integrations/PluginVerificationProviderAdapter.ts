import type { IPluginService } from '../interfaces/IPluginService.js';
import type { PluginInvocationResult } from '../models/PluginInvocation.js';

export interface PluginVerificationCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly message?: string | undefined;
  readonly errors: readonly string[];
  readonly sourcePlugin: string;
}

export class PluginVerificationProviderAdapter {
  constructor(private readonly pluginService: IPluginService) {}

  public async runVerification(
    pluginId: string,
    targetFile: string,
    workspaceId: string,
    projectId?: string,
    correlationId: string = `verif-${Date.now()}`
  ): Promise<PluginVerificationCheckResult> {
    try {
      const result: PluginInvocationResult = await this.pluginService.invokePlugin({
        pluginId,
        operation: 'verify',
        payload: { targetFile },
        workspaceId,
        projectId,
        correlationId,
        requestVersion: '1.0',
        requiredCapabilities: ['REPORT_VERIFICATION'],
        timeoutMs: 15000,
      });

      if (!result.success || !result.data || typeof result.data !== 'object') {
        return {
          checkName: `plugin-${pluginId}`,
          passed: false,
          errors: [result.error ?? 'Verification returned invalid response.'],
          sourcePlugin: pluginId,
        };
      }

      const data = result.data as any;
      return {
        checkName: typeof data.checkName === 'string' ? data.checkName : `plugin-${pluginId}`,
        passed: Boolean(data.passed),
        message: data.message,
        errors: Array.isArray(data.errors) ? data.errors : [],
        sourcePlugin: pluginId,
      };
    } catch (err: any) {
      return {
        checkName: `plugin-${pluginId}`,
        passed: false,
        errors: [err.message],
        sourcePlugin: pluginId,
      };
    }
  }
}
