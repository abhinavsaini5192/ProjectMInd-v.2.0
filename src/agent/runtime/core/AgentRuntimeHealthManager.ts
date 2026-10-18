import type { AgentRuntimeHealth, SubsystemHealthRecord, RuntimeHealthStatus } from '../models/AgentRuntimeHealth.js';
import type { IAgentRuntimeHealthManager } from '../interfaces/IAgentRuntimeHealthManager.js';

export class AgentRuntimeHealthManager implements IAgentRuntimeHealthManager {
  private readonly subsystems: Record<string, SubsystemHealthRecord> = {};

  constructor(private readonly runtimeId: string = 'runtime_default') {
    this.initDefaultSubsystems();
  }

  private initDefaultSubsystems(): void {
    const defaults = [
      'SESSION_MANAGER',
      'TASK_RUNTIME',
      'CONTEXT_ORCHESTRATOR',
      'TOOL_PIPELINE',
      'OBSERVATION_PROCESSOR',
      'VERIFICATION_PROCESSOR',
      'KNOWLEDGE_UPDATE',
      'ADAPTER_MANAGER',
    ];

    const now = Date.now();
    for (const name of defaults) {
      this.subsystems[name] = {
        status: 'HEALTHY',
        lastCheckedAt: now,
      };
    }
  }

  public recordSubsystemHealth(subsystemName: string, record: SubsystemHealthRecord): void {
    this.subsystems[subsystemName] = record;
  }

  public async getHealth(): Promise<AgentRuntimeHealth> {
    const entries = Object.entries(this.subsystems);
    let overallStatus: RuntimeHealthStatus = 'HEALTHY';

    for (const [, rec] of entries) {
      if (rec.status === 'UNHEALTHY') {
        overallStatus = 'UNHEALTHY';
      } else if (rec.status === 'DEGRADED' && overallStatus !== 'UNHEALTHY') {
        overallStatus = 'DEGRADED';
      }
    }

    return {
      status: overallStatus,
      runtimeId: this.runtimeId,
      subsystems: { ...this.subsystems },
      checkedAt: Date.now(),
    };
  }

  public async isHealthy(): Promise<boolean> {
    const health = await this.getHealth();
    return health.status !== 'UNHEALTHY';
  }
}
