import { describe, it, expect } from 'vitest';
import { PlatformLifecycleManager } from '../../src/platform/lifecycle/PlatformLifecycleManager.js';

describe('Platform Graceful Shutdown & Lifecycle', () => {
  it('executes shutdown sequence in ordered steps and marks state STOPPED', async () => {
    const executedSteps: string[] = [];

    const manager = new PlatformLifecycleManager(5000, {
      onStopInboundRequests: () => {
        executedSteps.push('stopInbound');
      },
      onStopAgentTasks: () => {
        executedSteps.push('stopTasks');
      },
      onPauseRuntime: () => {
        executedSteps.push('pauseRuntime');
      },
      onCreateCheckpoint: () => {
        executedSteps.push('checkpoint');
      },
      onFlushTelemetry: () => {
        executedSteps.push('flushTelemetry');
      },
      onCloseAdapters: () => {
        executedSteps.push('closeAdapters');
      },
      onCloseEventBus: () => {
        executedSteps.push('closeEventBus');
      },
      onCloseCache: () => {
        executedSteps.push('closeCache');
      },
      onCloseStorage: () => {
        executedSteps.push('closeStorage');
      },
    });

    expect(manager.getState()).toBe('CREATED');
    await manager.shutdown('normal shutdown');

    expect(manager.getState()).toBe('STOPPED');
    expect(executedSteps).toEqual([
      'stopInbound',
      'stopTasks',
      'pauseRuntime',
      'checkpoint',
      'flushTelemetry',
      'closeAdapters',
      'closeEventBus',
      'closeCache',
      'closeStorage',
    ]);
  });

  it('bounds shutdown execution with timeout if a hook hangs', async () => {
    const manager = new PlatformLifecycleManager(50, {
      onStopInboundRequests: async () => {
        // Hangs intentionally longer than the 50ms timeout
        await new Promise((resolve) => setTimeout(resolve, 500));
      },
    });

    const startTime = Date.now();
    await manager.shutdown('test timeout');
    const elapsedMs = Date.now() - startTime;

    expect(manager.getState()).toBe('STOPPED');
    // Shutdown should return near 50ms, not hang for 500ms
    expect(elapsedMs).toBeLessThan(350);
  });
});
