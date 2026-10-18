import type { JobType } from '../models/JobType.js';
import type { IJobHandler } from './IJobHandler.js';

export interface IJobRegistry {
  register<T = any>(type: JobType, handler: IJobHandler<T>): void;
  getHandler<T = any>(type: JobType): IJobHandler<T> | undefined;
  hasHandler(type: JobType): boolean;
  listRegisteredTypes(): readonly JobType[];
  clear(): void;
}

export const IJobRegistryToken = Symbol('IJobRegistry');
