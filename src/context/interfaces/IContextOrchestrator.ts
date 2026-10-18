import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextResponse } from '../models/ContextResponse.js';
import type { ContextPlan } from '../models/ContextPlan.js';
import type { ContextPackage } from '../models/ContextPackage.js';
import type { ContextExplanation } from '../models/ContextExplanation.js';
import type { TaskUnderstanding } from '../models/TaskUnderstanding.js';

export interface IContextOrchestrator {
  orchestrateContext(request: ContextRequest): Promise<ContextResponse>;
  getContextPlan(request: ContextRequest): Promise<ContextPlan>;
  getContextPackage(request: ContextRequest): Promise<ContextPackage>;
  getFeatureContextForTask(request: ContextRequest): Promise<ContextResponse>;
  getContextExplanation(request: ContextRequest): Promise<ContextExplanation>;
  estimateContextTokens(request: ContextRequest): Promise<number>;
  validateContextRequest(request: ContextRequest): void;
  understandTask?(request: ContextRequest): Promise<TaskUnderstanding>;
}
