import type { IJobHandler, JobExecutionContext } from '../../jobs/registry/IJobHandler.js';
import type { Job } from '../../jobs/models/Job.js';
import type { JobResult } from '../../jobs/models/JobResult.js';
import { JobError } from '../../jobs/models/JobError.js';
import type { IPluginService } from '../interfaces/IPluginService.js';

export interface PluginHealthCheckJobPayload {
  readonly pluginId?: string | undefined;
}

export class PluginHealthCheckJobHandler implements IJobHandler<PluginHealthCheckJobPayload> {
  constructor(private readonly pluginService: IPluginService) {}

  public validate(job: Job<PluginHealthCheckJobPayload>): void {
    // Optional pluginId
  }

  public async execute(
    job: Job<PluginHealthCheckJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    const startTime = Date.now();
    const { pluginId } = job.payload ?? {};

    await context.updateProgress(10, 100, 'Starting plugin health checks');

    const healthReports: Record<string, unknown>[] = [];
    if (pluginId) {
      const rep = await this.pluginService.checkHealth(pluginId);
      healthReports.push({ pluginId, ...rep });
    } else {
      const plugins = await this.pluginService.listPlugins();
      for (let i = 0; i < plugins.length; i++) {
        if (context.signal.aborted) {
          throw new JobError('JOB_CANCELLED', 'Job cancelled during health checks', false);
        }
        const p = plugins[i];
        const rep = await this.pluginService.checkHealth(p.pluginId);
        healthReports.push({ pluginId: p.pluginId, ...rep });
        await context.updateProgress(10 + Math.floor((i / plugins.length) * 80), 100, `Checked health for ${p.pluginId}`);
      }
    }

    await context.updateProgress(100, 100, 'Plugin health checks complete');

    return {
      durationMs: Date.now() - startTime,
      metrics: {
        checkedCount: healthReports.length,
      },
      output: { reports: healthReports },
    };
  }
}
