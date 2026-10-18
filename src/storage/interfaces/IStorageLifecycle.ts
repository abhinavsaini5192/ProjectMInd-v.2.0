import type { IStorageProvider } from './IStorageProvider';

export interface IStorageLifecycle {
  initialize(provider: IStorageProvider): Promise<void>;
  start(provider: IStorageProvider): Promise<void>;
  stop(provider: IStorageProvider): Promise<void>;
  dispose(provider: IStorageProvider): Promise<void>;
}

export const IStorageLifecycleToken = Symbol('IStorageLifecycle');
