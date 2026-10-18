import type { DistributedConfig } from '../models/DistributedConfig.js';
import type { IDistributedCoordinationBackend } from './IDistributedCoordinationBackend.js';
import { MemoryCoordinationBackend } from './MemoryCoordinationBackend.js';
import { FileSharedCoordinationBackend } from './FileSharedCoordinationBackend.js';
import { RedisCoordinationBackend } from './RedisCoordinationBackend.js';

export class CoordinationBackendFactory {
  public static create(
    config: DistributedConfig,
    logger?: { warn(msg: string, meta?: any): void; info(msg: string, meta?: any): void }
  ): IDistributedCoordinationBackend {
    if (config.mode === 'standalone' || config.backend === 'memory') {
      return new MemoryCoordinationBackend();
    }

    if (config.backend === 'file_shared') {
      const dir = config.sharedDirectory ?? '.projectmind/coordination';
      return new FileSharedCoordinationBackend(dir);
    }

    if (config.backend === 'redis') {
      try {
        return new RedisCoordinationBackend({
          redisUrl: config.redisUrl,
        });
      } catch (err) {
        if (logger) {
          logger.warn('Failed to initialize Redis backend; falling back to FileShared coordination', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
        const dir = config.sharedDirectory ?? '.projectmind/coordination';
        return new FileSharedCoordinationBackend(dir);
      }
    }

    return new MemoryCoordinationBackend();
  }
}
