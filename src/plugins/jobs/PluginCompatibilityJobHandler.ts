import type { IJobHandler, JobExecutionContext } from '../../jobs/registry/IJobHandler.js';
import type { Job } from '../../jobs/models/Job.js';
import type { JobResult } from '../../jobs/models/JobResult.js';
import { JobError } from '../../jobs/models/JobError.js';
import type { IPluginService } from '../interfaces/IPluginService.js';
import type { PluginCompatibilityResult } from '../models/PluginCompatibilityResult.js';

export interface PluginCompatibilityJobPayload {
  readonly pluginId?: string | undefined;
  readonly targetVersion?: string | undefined;
}

export class PluginCompatibilityJobHandler implements IJobHandler<PluginCompatibilityJobPayload> {
  constructor(private readonly pluginService: IPluginService) {}

  public validate(job: Job<PluginCompatibilityJobPayload>): void {
    // Optional pluginId; if omitted, checks all plugins
  }

  public async execute(
    job: Job<PluginCompatibilityJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    const startTime = Date.now();
    const { pluginId, targetVersion } = job.payload ?? {};

    await context.updateProgress(10, 100, 'Starting plugin compatibility checks');

    const results: PluginCompatibilityResult[] = [];
    if (pluginId) {
      const res = await this.pluginService.checkCompatibility(pluginId, targetVersion);
      results.push(res);
    } else {
      const plugins = await this.pluginService.listPlugins();
      for (let i = 0; i < plugins.length; i++) {
        if (context.signal.aborted) {
          throw new JobError('JOB_CANCELLED', 'Job cancelled during compatibility scan', false);
        }
        const p = plugins[i];
        const res = await this.pluginService.checkCompatibility(p.pluginId, targetVersion);
        results.push(res);
        await context.updateProgress(10 + Math.floor((i / plugins.length) * 80), 100, `Checked ${p.pluginId}`);
      }
    }

    await context.updateProgress(100, 100, 'Compatibility checks complete');

    return {
      durationMs: Date.now() - startTime,
      metrics: {
        checkedCount: results.length,
      },
      output: { results },
    };
  }
}
