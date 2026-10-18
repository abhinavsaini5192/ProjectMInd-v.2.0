import type { ContextPackage } from '../../../context/models/ContextPackage.js';
import type { AdapterContext } from '../models/AdapterContext.js';

export interface ContextMappingOptions {
  readonly format?: 'json' | 'markdown' | 'xml' | 'yaml' | string;
  readonly maxTokens?: number;
  readonly includeArchitecture?: boolean;
  readonly includeHealth?: boolean;
  readonly includeHistory?: boolean;
  readonly includeImpact?: boolean;
}

export interface IAgentContextMapper {
  mapContext(context: ContextPackage, options?: ContextMappingOptions): AdapterContext;
}
