import type { ContextPackage } from '../models/ContextPackage.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextPlan } from '../models/ContextPlan.js';
import type { SelectedContextData } from './IContextSelector.js';
import type { ContextAllocation } from '../models/ContextAllocation.js';
import type { ContextWarning } from '../models/ContextWarning.js';
import type { RetrievedContextData } from './IContextRetriever.js';

export interface BuildPackageParams {
  request: ContextRequest;
  plan: ContextPlan;
  selected: SelectedContextData;
  allocation: ContextAllocation;
  warnings: ContextWarning[];
  retrieved: RetrievedContextData;
}

export interface IContextPacker {
  buildPackage(params: BuildPackageParams): ContextPackage;
}
