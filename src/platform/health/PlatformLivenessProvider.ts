import type { LivenessReport } from './PlatformHealthModels.js';

export class PlatformLivenessProvider {
  private readonly processStartTime: number = Date.now();

  public getLiveness(): LivenessReport {
    return {
      status: 'alive',
      uptimeMs: Date.now() - this.processStartTime,
      timestamp: new Date().toISOString(),
    };
  }
}
