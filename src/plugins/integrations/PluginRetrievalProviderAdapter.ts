import type { IPluginService } from '../interfaces/IPluginService.js';
import type { PluginInvocationResult } from '../models/PluginInvocation.js';

export interface PluginSearchResult {
  readonly id: string;
  readonly title: string;
  readonly snippet: string;
  readonly score: number;
  readonly sourcePlugin: string;
}

export class PluginRetrievalProviderAdapter {
  constructor(private readonly pluginService: IPluginService) {}

  public async retrieve(
    pluginId: string,
    query: string,
    workspaceId: string,
    projectId?: string,
    limit: number = 10,
    correlationId: string = `ret-prov-${Date.now()}`
  ): Promise<PluginSearchResult[]> {
    try {
      const result: PluginInvocationResult = await this.pluginService.invokePlugin({
        pluginId,
        operation: 'search',
        payload: { query, limit },
        workspaceId,
        projectId,
        correlationId,
        requestVersion: '1.0',
        requiredCapabilities: ['PROVIDE_RETRIEVAL'],
        timeoutMs: 5000,
      });

      if (!result.success || !Array.isArray(result.data)) {
        return [];
      }

      const results: PluginSearchResult[] = [];
      for (const item of result.data) {
        if (item && typeof item === 'object' && typeof item.id === 'string') {
          results.push({
            id: item.id,
            title: typeof item.title === 'string' ? item.title : item.id,
            snippet: typeof item.snippet === 'string' ? item.snippet : '',
            score: typeof item.score === 'number' ? Math.max(0, Math.min(1, item.score)) : 0.5,
            sourcePlugin: pluginId,
          });
        }
      }

      return results;
    } catch (err) {
      console.warn(`[PluginRetrievalProviderAdapter] Plugin '${pluginId}' failed retrieval:`, err);
      return [];
    }
  }
}
