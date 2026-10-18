import type { IPluginService } from '../interfaces/IPluginService.js';
import type { IAgentToolRegistry } from '../../agent/protocol/interfaces/IAgentToolRegistry.js';
import type { AgentTool } from '../../agent/protocol/models/AgentTool.js';
import type { ToolCategory } from '../../agent/protocol/models/ToolCategory.js';

export interface PluginExposedTool {
  readonly toolName: string;
  readonly description: string;
  readonly category?: ToolCategory | undefined;
  readonly inputSchema: Record<string, unknown>;
  readonly outputSchema: Record<string, unknown>;
}

export class PluginToolProviderAdapter {
  constructor(
    private readonly pluginService: IPluginService,
    private readonly toolRegistry?: IAgentToolRegistry
  ) {}

  /**
   * Registers a plugin-provided tool into the canonical AgentToolRegistry.
   */
  public registerPluginTool(
    pluginId: string,
    toolDef: PluginExposedTool,
    workspaceId: string,
    projectId?: string
  ): AgentTool {
    const canonicalTool: AgentTool = {
      toolId: `tool-${pluginId}-${toolDef.toolName}`,
      name: `plugin_${pluginId.replace(/[^a-z0-9_]/gi, '_')}_${toolDef.toolName}`,
      description: toolDef.description,
      category: (toolDef.category as ToolCategory) ?? 'KNOWLEDGE',
      version: '1.0.0',
      operation: 'GET_CONTEXT',
      inputSchema: toolDef.inputSchema as any,
      outputSchema: toolDef.outputSchema as any,
      requiredCapabilities: ['CONTEXT_REQUEST'],
      requiredScope: 'WORKSPACE_REQUIRED',
      safetyLevel: 'READ_ONLY',
      limits: { defaultTimeoutMs: 10000, maxPayloadBytes: 1048576 },
      enabled: true,
      idempotent: true,
      retryable: true,
      metadata: {
        pluginId,
        workspaceId,
        projectId,
      },
    };

    if (this.toolRegistry) {
      this.toolRegistry.registerTool(canonicalTool);
    }

    return canonicalTool;
  }

  /**
   * Executes a registered plugin tool by invoking the backing plugin.
   */
  public async executePluginTool(
    pluginId: string,
    toolName: string,
    params: Record<string, unknown>,
    workspaceId: string,
    projectId?: string,
    correlationId: string = `tool-exec-${Date.now()}`
  ): Promise<unknown> {
    const result = await this.pluginService.invokePlugin({
      pluginId,
      operation: `tool:${toolName}`,
      payload: params,
      workspaceId,
      projectId,
      correlationId,
      requestVersion: '1.0',
      requiredCapabilities: ['PROVIDE_TOOL'],
      timeoutMs: 10000,
    });

    if (!result.success) {
      throw new Error(`Plugin tool execution failed: ${result.error}`);
    }

    return result.data;
  }
}
