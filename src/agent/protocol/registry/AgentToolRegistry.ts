import type { AgentTool } from '../models/AgentTool.js';
import type { ToolCategory } from '../models/ToolCategory.js';
import type { ToolDiscoveryResponse, ToolDiscoveryItem } from '../models/ToolDiscoveryResponse.js';
import type { AgentCapability } from '../../models/AgentCapability.js';
import type { IAgentToolRegistry } from '../interfaces/IAgentToolRegistry.js';
import { ToolProtocolError } from '../errors/ToolProtocolError.js';

export class AgentToolRegistry implements IAgentToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  public registerTool(tool: AgentTool): void {
    this.validateTool(tool);

    if (this.tools.has(tool.name)) {
      throw new ToolProtocolError(`Tool with name '${tool.name}' is already registered in registry`, {
        toolName: tool.name,
      });
    }

    this.tools.set(tool.name, Object.freeze({ ...tool }));
  }

  public unregisterTool(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  public getTool(toolName: string): AgentTool | undefined {
    return this.tools.get(toolName);
  }

  public listTools(): readonly AgentTool[] {
    return Array.from(this.tools.values());
  }

  public getToolsByCategory(category: ToolCategory): readonly AgentTool[] {
    return this.listTools().filter((t) => t.category === category);
  }

  public getToolsForCapabilities(capabilities: readonly AgentCapability[]): readonly AgentTool[] {
    const capSet = new Set(capabilities);
    return this.listTools().filter((t) =>
      t.requiredCapabilities.every((reqCap) => capSet.has(reqCap))
    );
  }

  public isToolAvailable(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    return tool !== undefined && tool.enabled === true;
  }

  public validateTool(tool: AgentTool): void {
    if (!tool || typeof tool !== 'object') {
      throw new ToolProtocolError('AgentTool definition must be an object');
    }

    if (!tool.toolId || typeof tool.toolId !== 'string' || !tool.toolId.trim()) {
      throw new ToolProtocolError('AgentTool definition missing valid toolId');
    }

    if (!tool.name || typeof tool.name !== 'string' || !tool.name.trim()) {
      throw new ToolProtocolError('AgentTool definition missing valid name');
    }

    if (!/^[a-z0-9_]+$/i.test(tool.name)) {
      throw new ToolProtocolError(
        `AgentTool name '${tool.name}' contains invalid characters. Only alphanumeric and underscores allowed.`,
        { toolName: tool.name }
      );
    }

    if (!tool.description || typeof tool.description !== 'string' || !tool.description.trim()) {
      throw new ToolProtocolError(`AgentTool '${tool.name}' missing valid description`);
    }

    if (!tool.category || typeof tool.category !== 'string') {
      throw new ToolProtocolError(`AgentTool '${tool.name}' missing valid category`);
    }

    if (!tool.version || typeof tool.version !== 'string') {
      throw new ToolProtocolError(`AgentTool '${tool.name}' missing valid version`);
    }

    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      throw new ToolProtocolError(`AgentTool '${tool.name}' missing valid inputSchema`);
    }

    if (!tool.outputSchema || typeof tool.outputSchema !== 'object') {
      throw new ToolProtocolError(`AgentTool '${tool.name}' missing valid outputSchema`);
    }

    if (!Array.isArray(tool.requiredCapabilities)) {
      throw new ToolProtocolError(`AgentTool '${tool.name}' requiredCapabilities must be an array`);
    }

    if (!tool.requiredScope) {
      throw new ToolProtocolError(`AgentTool '${tool.name}' missing requiredScope`);
    }

    if (!tool.safetyLevel) {
      throw new ToolProtocolError(`AgentTool '${tool.name}' missing safetyLevel`);
    }

    if (!tool.limits || typeof tool.limits !== 'object') {
      throw new ToolProtocolError(`AgentTool '${tool.name}' missing limits`);
    }
  }

  public getDiscoveryInfo(agentCapabilities?: readonly AgentCapability[]): ToolDiscoveryResponse {
    let candidateTools = this.listTools().filter((t) => t.enabled);

    if (agentCapabilities) {
      const capSet = new Set(agentCapabilities);
      candidateTools = candidateTools.filter((t) =>
        t.requiredCapabilities.every((c) => capSet.has(c))
      );
    }

    const discoveryItems: ToolDiscoveryItem[] = candidateTools.map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      version: t.version,
      inputSchema: t.inputSchema,
      outputSchema: t.outputSchema,
      requiredCapabilities: t.requiredCapabilities,
      requiredScope: t.requiredScope,
      safetyLevel: t.safetyLevel,
      limits: t.limits,
      idempotent: t.idempotent,
      retryable: t.retryable,
      enabled: t.enabled,
    }));

    const categories = Array.from(new Set(discoveryItems.map((item) => item.category)));

    return {
      protocolVersion: '1.0',
      tools: discoveryItems,
      categories,
      totalTools: discoveryItems.length,
    };
  }
}
