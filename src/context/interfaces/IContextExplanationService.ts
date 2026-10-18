import type { ContextRequest } from '../models/ContextRequest.js';
import type { SelectedContextData } from './IContextSelector.js';
import type { ContextExplanation } from '../models/ContextExplanation.js';

export interface IContextExplanationService {
  generateExplanation(request: ContextRequest, selected: SelectedContextData): ContextExplanation;
}
