import type { PluginInvocationRequest, PluginInvocationResult } from '../models/PluginInvocation.js';
import type { IPlugin, PluginHealthReport } from './IPlugin.js';

export interface IPluginExecutionManager {
  registerInstance(pluginId: string, instance: IPlugin): void;
  unregisterInstance(pluginId: string): void;
  getInstance(pluginId: string): IPlugin | undefined;
  invoke(request: PluginInvocationRequest): Promise<PluginInvocationResult>;
  checkHealth(pluginId: string): Promise<PluginHealthReport>;
  shutdownAll(): Promise<void>;
}
