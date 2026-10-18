import type { IJobRegistry } from './IJobRegistry.js';
import type { IJobHandler } from './IJobHandler.js';
import type { JobType } from '../models/JobType.js';
import { JobError } from '../models/JobError.js';

export class JobRegistry implements IJobRegistry {
  private readonly handlers = new Map<JobType, IJobHandler>();

  public register<T = any>(type: JobType, handler: IJobHandler<T>): void {
    if (this.handlers.has(type)) {
      throw new JobError(
        'INVALID_JOB',
        `Job handler for type '${type}' is already registered. Duplicate registrations are rejected.`,
        false
      );
    }
    this.handlers.set(type, handler as IJobHandler);
  }

  public getHandler<T = any>(type: JobType): IJobHandler<T> | undefined {
    return this.handlers.get(type) as IJobHandler<T> | undefined;
  }

  public hasHandler(type: JobType): boolean {
    return this.handlers.has(type);
  }

  public listRegisteredTypes(): readonly JobType[] {
    return Array.from(this.handlers.keys());
  }

  public clear(): void {
    this.handlers.clear();
  }
}
