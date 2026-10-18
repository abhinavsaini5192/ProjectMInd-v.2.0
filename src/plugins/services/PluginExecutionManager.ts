import type { IPluginExecutionManager } from '../interfaces/IPluginExecutionManager.js';
import type { IPlugin, PluginHealthReport } from '../interfaces/IPlugin.js';
import type { IPluginStore } from '../interfaces/IPluginStore.js';
import type { PluginInvocationRequest, PluginInvocationResult } from '../models/PluginInvocation.js';
import { PluginNotFoundError, PluginTimeoutError, PluginExecutionError } from '../errors/PluginError.js';

export class PluginExecutionManager implements IPluginExecutionManager {
  private readonly instances = new Map<string, IPlugin>();

  constructor(private readonly store?: IPluginStore) {}

  public registerInstance(pluginId: string, instance: IPlugin): void {
    this.instances.set(pluginId, instance);
  }

  public unregisterInstance(pluginId: string): void {
    this.instances.delete(pluginId);
  }

  public getInstance(pluginId: string): IPlugin | undefined {
    return this.instances.get(pluginId);
  }

  public async invoke(request: PluginInvocationRequest): Promise<PluginInvocationResult> {
    const instance = this.instances.get(request.pluginId);
    if (!instance) {
      throw new PluginNotFoundError(request.pluginId);
    }

    const startTime = Date.now();
    const timeoutMs = request.timeoutMs ?? 30000;

    let timer: NodeJS.Timeout | undefined;
    let abortListener: (() => void) | undefined;

    try {
      if (request.signal?.aborted) {
        throw new PluginExecutionError(request.pluginId, request.operation, 'Invocation was cancelled before execution.');
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new PluginTimeoutError(request.pluginId, request.operation, timeoutMs));
        }, timeoutMs);
      });

      const abortPromise = new Promise<never>((_, reject) => {
        if (request.signal) {
          abortListener = () => {
            reject(new PluginExecutionError(request.pluginId, request.operation, 'Invocation was cancelled by caller.'));
          };
          request.signal.addEventListener('abort', abortListener);
        }
      });

      const executionPromise = instance.invoke(request);

      const rawResult = await Promise.race([executionPromise, timeoutPromise, abortPromise]);
      const durationMs = Date.now() - startTime;

      // Sanitize output
      const sanitizedData = this.sanitizeOutput(rawResult.data);

      const result: PluginInvocationResult = {
        success: rawResult.success,
        data: sanitizedData,
        error: rawResult.error,
        errorCategory: rawResult.errorCategory,
        durationMs,
        correlationId: request.correlationId,
      };

      if (this.store) {
        await this.store.saveExecutionRecord({
          executionId: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          pluginId: request.pluginId,
          operation: request.operation,
          workspaceId: request.workspaceId,
          projectId: request.projectId,
          status: result.success ? 'SUCCESS' : 'FAILURE',
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          durationMs,
          correlationId: request.correlationId,
          errorMessage: result.error,
          errorCategory: result.errorCategory,
        });
      }

      return result;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout = err instanceof PluginTimeoutError;
      const isCancelled = err.message?.includes('cancelled');

      const status = isTimeout ? 'TIMEOUT' : isCancelled ? 'CANCELLED' : 'FAILURE';

      if (this.store) {
        await this.store.saveExecutionRecord({
          executionId: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          pluginId: request.pluginId,
          operation: request.operation,
          workspaceId: request.workspaceId,
          projectId: request.projectId,
          status,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          durationMs,
          correlationId: request.correlationId,
          errorMessage: err.message,
          errorCategory: isTimeout ? 'TIMEOUT' : 'EXECUTION_EXCEPTION',
        });
      }

      if (isTimeout) {
        throw err;
      }

      return {
        success: false,
        error: err.message,
        errorCategory: isCancelled ? 'CANCELLED' : 'EXECUTION_EXCEPTION',
        durationMs,
        correlationId: request.correlationId,
      };
    } finally {
      if (timer) clearTimeout(timer);
      if (request.signal && abortListener) {
        request.signal.removeEventListener('abort', abortListener);
      }
    }
  }

  public async checkHealth(pluginId: string): Promise<PluginHealthReport> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      return {
        status: 'UNHEALTHY',
        message: `Plugin instance '${pluginId}' is not loaded in memory.`,
        checkedAt: new Date().toISOString(),
      };
    }

    if (typeof instance.healthCheck === 'function') {
      try {
        return await instance.healthCheck();
      } catch (err: any) {
        return {
          status: 'UNHEALTHY',
          message: `Health check thrown error: ${err.message}`,
          checkedAt: new Date().toISOString(),
        };
      }
    }

    return {
      status: 'HEALTHY',
      message: 'Plugin is active and responsive.',
      checkedAt: new Date().toISOString(),
    };
  }

  public async shutdownAll(): Promise<void> {
    for (const [id, instance] of this.instances.entries()) {
      if (typeof instance.shutdown === 'function') {
        try {
          await instance.shutdown();
        } catch (err) {
          console.error(`Error shutting down plugin '${id}':`, err);
        }
      }
    }
    this.instances.clear();
  }

  private sanitizeOutput<T>(data: T): T {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') {
      // Basic strip of suspicious script injection tags
      return data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') as unknown as T;
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeOutput(item)) as unknown as T;
    }
    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
        sanitized[key] = this.sanitizeOutput(val);
      }
      return sanitized as unknown as T;
    }
    return data;
  }
}
