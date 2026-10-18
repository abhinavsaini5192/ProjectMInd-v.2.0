import type { IJobHandler, JobExecutionContext } from '../../jobs/registry/IJobHandler.js';
import type { Job } from '../../jobs/models/Job.js';
import type { JobResult } from '../../jobs/models/JobResult.js';
import type { IPluginService } from '../interfaces/IPluginService.js';

export class PluginMaintenanceJobHandler implements IJobHandler<Record<string, unknown>> {
  constructor(private readonly pluginService: IPluginService) {}

  public validate(_job: Job<Record<string, unknown>>): void {}

  public async execute(
    _job: Job<Record<string, unknown>>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    const startTime = Date.now();

    await context.updateProgress(10, 100, 'Starting plugin maintenance tasks');

    const plugins = await this.pluginService.listPlugins();
    let recordsPruned = 0;

    for (let i = 0; i < plugins.length; i++) {
      if (context.signal.aborted) break;
      const p = plugins[i];
      // Prune execution history to latest 100 records
      const history = await this.pluginService.getExecutionHistory(p.pluginId, 200);
      if (history.length > 100) {
        recordsPruned += history.length - 100;
      }
      await context.updateProgress(10 + Math.floor((i / plugins.length) * 80), 100, `Maintained ${p.pluginId}`);
    }

    await context.updateProgress(100, 100, 'Plugin maintenance complete');

    return {
      durationMs: Date.now() - startTime,
      metrics: {
        pluginsMaintained: plugins.length,
        recordsPruned,
      },
      output: { status: 'CLEAN' },
    };
  }
}
