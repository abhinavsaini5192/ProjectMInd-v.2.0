import type { DIContainer } from '../../workspace/di/DIContainer.js';
import { PlatformTokens } from './PlatformTokens.js';
import type { ProjectMindPlatform } from '../core/ProjectMindPlatform.js';

export class PlatformDISetup {
  public static registerPlatform(container: DIContainer, platform: ProjectMindPlatform): void {
    container.registerFactory(PlatformTokens.IPlatformConfig, () => platform.config, 'Singleton');
    container.registerFactory(PlatformTokens.IProductionLogger, () => platform.logger, 'Singleton');
    container.registerFactory(PlatformTokens.IPlatformHealthService, () => platform.healthService, 'Singleton');
    container.registerFactory(PlatformTokens.IPlatformTelemetry, () => platform.telemetry, 'Singleton');
    container.registerFactory(PlatformTokens.IPlatformLifecycleManager, () => platform.lifecycle, 'Singleton');
    container.registerFactory(PlatformTokens.IProjectMindPlatform, () => platform, 'Singleton');
  }
}
