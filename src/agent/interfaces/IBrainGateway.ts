import type { AgentTask } from '../models/AgentTask.js';
import type { ContextPackage } from '../../intelligence/fusion/models/ContextPackage.js';

export interface IBrainGateway {
  /**
   * Translates an AgentTask into a structured ContextPackage
   * representing the Brain's understanding and fused intelligence.
   */
  requestContext(task: AgentTask): Promise<ContextPackage>;
}
