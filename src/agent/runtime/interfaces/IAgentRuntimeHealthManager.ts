import type { AgentRuntimeHealth, SubsystemHealthRecord } from '../models/AgentRuntimeHealth.js';

export interface IAgentRuntimeHealthManager {
  getHealth(): Promise<AgentRuntimeHealth>;
  recordSubsystemHealth(subsystemName: string, record: SubsystemHealthRecord): void;
  isHealthy(): Promise<boolean>;
}
