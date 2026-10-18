import type { ContextPackage } from '../../../context/models/ContextPackage.js';
import type { ContextPlan } from '../../../context/models/ContextPlan.js';

export interface ContextPackageResponse {
  readonly contextPackage: ContextPackage;
}

export interface ContextPlanResponse {
  readonly plan: ContextPlan;
}

export interface ContextEstimateResponse {
  readonly estimatedTokens: number;
  readonly breakdown: Record<string, number>;
}
