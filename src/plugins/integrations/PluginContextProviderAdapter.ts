import type { IPluginService } from '../interfaces/IPluginService.js';
import type { PluginInvocationResult } from '../models/PluginInvocation.js';

export interface PluginContextItem {
  readonly uri: string;
  readonly content: string;
  readonly relevanceScore: number;
  readonly reason: string;
  readonly sourcePlugin: string;
}

export class PluginContextProviderAdapter {
  constructor(private readonly pluginService: IPluginService) {}

  /**
   * Invokes an enabled CONTEXT_PROVIDER plugin to contribute contextual items.
   */
  public async provideContext(
    pluginId: string,
    query: string,
    workspaceId: string,
    projectId?: string,
    correlationId: string = `ctx-prov-${Date.now()}`
  ): Promise<PluginContextItem[]> {
    try {
      const result: PluginInvocationResult = await this.pluginService.invokePlugin({
        pluginId,
        operation: 'provideContext',
        payload: { query },
        workspaceId,
        projectId,
        correlationId,
        requestVersion: '1.0',
        requiredCapabilities: ['PROVIDE_CONTEXT'],
        timeoutMs: 5000, // fast timeout for context generation
      });

      if (!result.success || !Array.isArray(result.data)) {
        return [];
      }

      const validItems: PluginContextItem[] = [];
      for (const item of result.data) {
        if (item && typeof item === 'object' && typeof item.uri === 'string' && typeof item.content === 'string') {
          validItems.push({
            uri: item.uri,
            content: item.content,
            relevanceScore: typeof item.relevanceScore === 'number' ? Math.max(0, Math.min(1, item.relevanceScore)) : 0.5,
            reason: typeof item.reason === 'string' ? item.reason : 'Provided by plugin',
            sourcePlugin: pluginId,
          });
        }
      }

      return validItems;
    } catch (err) {
      // Failure containment: isolated so context orchestration continues
      console.warn(`[PluginContextProviderAdapter] Plugin '${pluginId}' failed to provide context:`, err);
      return [];
    }
  }
}
